# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Ask a Bedrock model for an answer that matches a JSON schema, through Strands Agents.

Strands' ``BedrockModel.structured_output`` uses Converse JSON schema output (``outputConfig``) on models that support
it, such as Claude, and a forced tool call on models that don't, such as Amazon Nova. Tool property names must match
``^[a-zA-Z0-9_.-]{1,64}$``, so the Pydantic model it gets has safe keys, and the answer is mapped back to the original
names. Strands validates every answer against that model, and the model gets one retry when it doesn't match.
"""

import asyncio
import functools
import re
import unicodedata
from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING, Any, Literal

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    CONTENT_FILTER_STOP_REASONS,
    handle_bedrock_client_error,
    supports_temperature,
)
from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, ModelResponseError
from amzn_smart_product_onboarding_core_utils.logger import logger
from botocore.exceptions import ClientError
from pydantic import BaseModel, ConfigDict, Field, create_model
from pydantic import ValidationError as PydanticValidationError
from strands.models.bedrock import BedrockModel

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
else:
    BedrockRuntimeClient = object

# Both answers are a few hundred tokens.
MAX_TOKENS = 4096
MAX_KEY_LENGTH = 64


def safe_keys(names: Iterable[str]) -> dict[str, str]:
    """Map each name to a readable key that Bedrock accepts in a tool schema: accents dropped, other runs of
    non-alphanumeric characters made one underscore, and a numeric suffix on a key already taken."""
    keys: dict[str, str] = {}
    for name in names:
        ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        base = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_name).strip("_")[:MAX_KEY_LENGTH] or "field"
        key, number = base, 2
        while key in keys.values():
            suffix = f"_{number}"
            key, number = base[: MAX_KEY_LENGTH - len(suffix)] + suffix, number + 1
        keys[name] = key
    return keys


def _annotation(prop: dict) -> Any:
    # shortcut: only the property shapes our two schemas use. The Pydantic model is the only check on the answer, so a
    # keyword it doesn't enforce, such as maxLength, is refused rather than ignored.
    if set(prop) <= {"type", "enum"}:
        if "enum" in prop:
            return Literal[tuple(prop["enum"])]
        if prop.get("type") == "string":
            return str
        if prop.get("type") == ["string", "null"]:
            return str | None
    raise ValueError(f"Unsupported schema property: {sorted(prop)}")


def output_model(schema: dict, name: str, keys: dict[str, str]) -> type[BaseModel]:
    """A Pydantic model for `schema`, in its order, with the safe keys as aliases, every property required as in our
    schemas, and extra keys forbidden."""
    fields: dict[str, Any] = {}
    # Internal field names never clash with BaseModel attributes; the safe key is the alias the model sees.
    for index, (original, prop) in enumerate(schema["properties"].items()):
        # Strands only uses JSON schema output when every node has a type, and Pydantic writes a nullable enum
        # without one. Strands drops the type again from the outputConfig schema, so Bedrock gets the enum alone,
        # which doesn't count toward its limit of 16 union-typed properties.
        extra = {"type": ["string", "null"]} if None in prop.get("enum", ()) else None
        fields[f"field_{index}"] = (
            _annotation(prop),
            Field(
                ...,
                alias=keys[original],
                title=original,
                description=original if keys[original] != original else None,
                json_schema_extra=extra,
            ),
        )
    return create_model(name, __config__=ConfigDict(extra="forbid"), **fields)


def is_schema_too_complex(error: ClientError) -> bool:
    return error.response["Error"]["Code"] == "ValidationException" and "Schema is too complex" in error.response[
        "Error"
    ].get("Message", "")


class _SchemaTooComplex(Exception):
    """Carries Bedrock's refusal to compile a schema, its one argument, past Strands, which would answer without it."""


class _Client:
    """The caller's Bedrock client, handed to Strands as its boto session too, so Strands doesn't create its own."""

    def __init__(self, client: "BedrockRuntimeClient"):
        self._client = client
        self.region_name = client.meta.region_name

    def client(self, *args: Any, **kwargs: Any) -> "_Client":
        return self

    def converse(self, **request: Any) -> dict:
        try:
            # Throttling becomes RateLimitError here, before Strands turns it into its own exception.
            return handle_bedrock_client_error(self._client.converse)(**request)
        except ClientError as e:
            if is_schema_too_complex(e):
                raise _SchemaTooComplex(e) from None
            raise

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


# One BedrockModel per caller client and model.
@functools.lru_cache(maxsize=8)
def _model(bedrock: "BedrockRuntimeClient", model_id: str) -> BedrockModel:
    # Converse, not ConverseStream: the Step Functions task roles only allow bedrock:InvokeModel.
    return BedrockModel(boto_session=_Client(bedrock), model_id=model_id, max_tokens=MAX_TOKENS, streaming=False)


class _Invalid(Exception):
    """An answer to ask again for, with feedback for the model, which can contain its values, and fields to log."""


async def _ask(
    model: BedrockModel, output_type: type[BaseModel], system_prompt: str, prompt: str, originals: dict[str, str]
) -> BaseModel:
    stop_reason = usage = result = None
    try:
        async for event in model.structured_output(
            output_type, [{"role": "user", "content": [{"text": prompt}]}], system_prompt=system_prompt
        ):
            if "stop" in event:
                stop_reason, _, usage, _ = event["stop"]
            result = event.get("output", result)
        return result
    except PydanticValidationError as e:
        # Raised by Strands as it builds the output model from the answer. The messages have no values.
        feedback, logged = [], set()
        for error in e.errors(include_input=False, include_url=False):
            path = "/".join(originals.get(str(part), str(part)) for part in error["loc"]) or "<root>"
            feedback.append(f"{path}: {error['msg']}")
            # An extra key is the model's own text, so the log doesn't name it.
            logged.add(f"{'<extra key>' if error['type'] == 'extra_forbidden' else path}: {error['type']}")
        raise _Invalid(
            "The answer does not match the schema: " + "; ".join(feedback), {"errors": sorted(logged)}
        ) from None
    except ValueError:
        # Strands raises ValueError, with the stop reason in its message, when the model gave no answer.
        if stop_reason in CONTENT_FILTER_STOP_REASONS:
            raise ContentFilteredError() from None
        raise _Invalid("Answer with the structured output only.", {"stop_reason": stop_reason}) from None
    finally:
        if usage:
            logger.info({"usage": {"inputTokens": usage["inputTokens"], "outputTokens": usage["outputTokens"]}})


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
    """Return the model's answer to `prompt` that matches `schema`, as a dict with the original names.

    `check` can reject a matching answer; the message it returns goes to the model with the retry and is not logged.

    Raises:
        ContentFilteredError: A content filter or guardrail stopped the model.
        ModelResponseError: The answer still didn't match after the retry.
        RateLimitError: Bedrock throttled the request.
        RetryableError: Bedrock timed out or was unavailable.
        ClientError: Any other Bedrock error, unchanged, such as a schema too complex to compile.
    """
    keys = safe_keys(schema["properties"])
    originals = {key: original for original, key in keys.items()}
    output_type = output_model(schema, name, keys)
    model = _model(bedrock, model_id)
    # Claude 4.7 and later reject temperature.
    if supports_temperature(model_id):
        model.update_config(temperature=temperature)

    attempt_prompt = prompt
    for attempt in (1, 2):
        try:
            result = asyncio.run(_ask(model, output_type, system_prompt, attempt_prompt, originals))
            answer = {originals[key]: value for key, value in result.model_dump(by_alias=True).items()}
            if check and (problem := check(answer)):
                raise _Invalid(problem, {"check_failed": True})
            return answer
        except _SchemaTooComplex as e:
            raise e.args[0] from None
        except ClientError as e:
            # For example, a ValidationException for a model that can't run the request.
            logger.error({"model_id": model_id, "error": e.response["Error"]})
            raise
        except _Invalid as e:
            feedback, log = e.args
            logger.warning({"schema_mismatch": name, "attempt": attempt, **log})
            attempt_prompt = f"{prompt}\n\nYour previous answer was rejected. {feedback}"
    raise ModelResponseError(f"No valid {name} answer")
