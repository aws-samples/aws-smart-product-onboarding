# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Ask a Bedrock model for an answer that matches a JSON schema, through Pydantic AI.

Pydantic AI picks how to constrain the answer from the model's profile: Converse JSON schema output
(``outputConfig``) on models that support it, such as Claude Sonnet 5.5 and Haiku 5.5, and a forced tool call
on models that don't, such as Amazon Nova. Bedrock doesn't check a tool call's input against its schema, so
every answer is validated here as well, and the model gets one retry when it doesn't match.
"""

from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import supports_temperature
from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, ModelResponseError
from amzn_smart_product_onboarding_core_utils.logger import logger
from botocore.exceptions import ClientError
from jsonschema import Draft202012Validator, ValidationError
from pydantic_ai import Agent, ModelRetry, StructuredDict
from pydantic_ai.exceptions import ContentFilterError, ModelAPIError, UnexpectedModelBehavior
from pydantic_ai.models.bedrock import BedrockConverseModel
from pydantic_ai.providers.bedrock import BedrockProvider
from pydantic_ai.settings import ModelSettings

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
else:
    BedrockRuntimeClient = object

# One retry when the answer doesn't match the schema.
OUTPUT_RETRIES = 1
# Both answers are a few hundred tokens. Setting a limit also keeps Pydantic AI on Converse: without one it
# streams with ConverseStream, which the Step Functions tasks' roles don't allow.
MAX_TOKENS = 4096


def _schema_errors(schema: dict, value: Any) -> list[ValidationError]:
    return sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: list(error.absolute_path))


def _where(error: ValidationError) -> str:
    """The path and failed keyword of an error, without the value: values can repeat seller-supplied data."""
    return f"{'/'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.validator}"


def get_structured_output(
    bedrock: "BedrockRuntimeClient",
    model_id: str,
    system_prompt: str,
    prompt: str,
    schema: dict,
    name: str,
    temperature: float = 0,
    check: Callable[[dict], str | None] | None = None,
) -> dict:
    """Return the model's answer to `prompt` as a dict that matches `schema`.

    `check` can reject an answer that matches the schema; the message it returns goes to the model with the retry,
    and is not logged.

    Raises:
        ContentFilteredError: A content filter or guardrail stopped the model.
        ModelResponseError: The answer still didn't match the schema after the retry, or was incomplete.
        ClientError: Bedrock rejected the request, unchanged, so callers can map throttling and retryable errors
            and see a ValidationException such as a schema too complex to compile.
    """
    model = BedrockConverseModel(model_id, provider=BedrockProvider(bedrock_client=bedrock))
    agent = Agent(
        model,
        output_type=StructuredDict(schema, name=name),
        system_prompt=system_prompt,
        retries=OUTPUT_RETRIES,
    )

    @agent.output_validator
    def validate(output: dict) -> dict:
        if errors := _schema_errors(schema, output):
            logger.warning({"schema_mismatch": name, "errors": [_where(error) for error in errors]})
            # The model gets the full messages; only the log leaves the values out.
            raise ModelRetry("The answer does not match the schema: " + "; ".join(error.message for error in errors))
        if check and (problem := check(output)):
            logger.warning({"check_failed": name})
            raise ModelRetry(problem)
        return output

    settings = ModelSettings(max_tokens=MAX_TOKENS)
    # Claude 4.7 and later reject temperature.
    if supports_temperature(model_id):
        settings["temperature"] = temperature
    # Pydantic AI's exceptions are not chained: they can carry the response body, which can repeat seller data.
    try:
        result = agent.run_sync(prompt, model_settings=settings)
    except ContentFilterError:
        logger.warning({"content_filtered": name})
        raise ContentFilteredError() from None
    except UnexpectedModelBehavior as e:
        # Raised after the retry still fails validation, or when the answer stopped early (max_tokens).
        logger.error({"model_response_error": name, "error_type": type(e).__name__})
        raise ModelResponseError(f"No valid {name} answer") from None
    except ModelAPIError as e:
        if isinstance(e.__cause__, ClientError):
            raise e.__cause__ from None
        raise
    logger.info({"usage": {"inputTokens": result.usage.input_tokens, "outputTokens": result.usage.output_tokens}})
    return result.output
