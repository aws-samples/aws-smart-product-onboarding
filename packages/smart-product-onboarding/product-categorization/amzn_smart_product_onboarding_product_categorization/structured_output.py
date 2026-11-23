# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Ask a Bedrock model for an answer that matches a JSON schema, through Strands Agents.

Strands' ``BedrockModel.structured_output`` picks how to constrain the answer from the model: Converse JSON schema
output (``outputConfig``) on models that support it, such as Claude Sonnet 5.5 and Haiku 5.5, and a forced tool call
on models that don't, such as Amazon Nova. It takes a Pydantic model and also sends it as a tool definition, whose
property names must match ``^[a-zA-Z0-9_.-]{1,64}$``, so this module builds the model from our JSON schema with safe
keys and maps the answer back to the original names. Bedrock doesn't check a tool call's input against its schema, so
every answer is validated against the original schema here, and the model gets one retry when it doesn't match.
"""

import asyncio
import functools
import re
import unicodedata
from collections.abc import Callable, Iterable
from typing import TYPE_CHECKING, Any, Literal

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    CONTENT_FILTER_STOP_REASONS,
    supports_temperature,
)
from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, ModelResponseError
from amzn_smart_product_onboarding_core_utils.logger import logger
from botocore.exceptions import ClientError
from jsonschema import Draft202012Validator, ValidationError
from pydantic import BaseModel, ConfigDict, Field, create_model
from pydantic import ValidationError as PydanticValidationError
from strands.models.bedrock import BedrockModel
from strands.types.exceptions import ModelThrottledException

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
else:
    BedrockRuntimeClient = object

# One retry when the answer doesn't match the schema.
OUTPUT_RETRIES = 1
# Both answers are a few hundred tokens.
MAX_TOKENS = 4096
MAX_KEY_LENGTH = 64


def safe_keys(names: Iterable[str]) -> dict[str, str]:
    """Map each name to a key that Bedrock accepts in a tool schema, readable and the same on every call.

    Letters and digits are kept, accents are dropped, and every other run of characters becomes one underscore.
    A key that is already taken gets a numeric suffix.
    """
    keys: dict[str, str] = {}
    used: set[str] = set()
    for name in names:
        ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
        base = re.sub(r"[^a-zA-Z0-9]+", "_", ascii_name).strip("_")[:MAX_KEY_LENGTH] or "field"
        key, number = base, 2
        while key in used:
            suffix = f"_{number}"
            key, number = base[: MAX_KEY_LENGTH - len(suffix)] + suffix, number + 1
        used.add(key)
        keys[name] = key
    return keys


def _annotation(prop: dict) -> Any:
    # shortcut: only the property shapes our two schemas use; extend this when a schema needs another shape.
    if "enum" in prop:
        return Literal[tuple(prop["enum"])]
    if prop.get("type") == "string":
        return str
    if prop.get("type") == ["string", "null"]:
        return str | None
    raise ValueError(f"Unsupported schema property: {sorted(prop)}")


def output_model(schema: dict, name: str, keys: dict[str, str]) -> type[BaseModel]:
    """A Pydantic model for `schema` whose fields are the safe keys, titled with the original names.

    Fields keep the schema's order, enums (null included) and required list, and extra keys are forbidden.
    """
    required = set(schema.get("required", []))
    fields: dict[str, Any] = {}
    # Internal field names never clash with BaseModel attributes; the safe key is the alias the model sees.
    for index, (original, prop) in enumerate(schema["properties"].items()):
        renamed = keys[original] != original
        # Strands only uses JSON schema output when every node has a type, and Pydantic writes a nullable enum
        # without one. Strands drops the type again from the outputConfig schema, so Bedrock gets the enum alone,
        # which doesn't count toward its limit of 16 union-typed properties.
        extra = {"type": ["string", "null"]} if None in prop.get("enum", ()) else None
        fields[f"field_{index}"] = (
            _annotation(prop),
            Field(
                ... if original in required else None,
                alias=keys[original],
                title=original,
                description=original if renamed else None,
                json_schema_extra=extra,
            ),
        )
    return create_model(name, __config__=ConfigDict(extra="forbid"), **fields)


class _SchemaTooComplex(Exception):
    """Carries Bedrock's refusal to compile a schema past Strands, which would otherwise retry without the schema."""

    def __init__(self, error: ClientError):
        super().__init__("Schema is too complex for compilation")
        self.error = error


def is_schema_too_complex(error: ClientError) -> bool:
    return error.response["Error"]["Code"] == "ValidationException" and "Schema is too complex" in error.response[
        "Error"
    ].get("Message", "")


class _Client:
    """The caller's Bedrock client, as Strands sees it."""

    def __init__(self, client: "BedrockRuntimeClient"):
        self._client = client

    def converse(self, **request: Any) -> dict:
        try:
            return self._client.converse(**request)
        except ClientError as e:
            if "outputConfig" in request and is_schema_too_complex(e):
                raise _SchemaTooComplex(e) from None
            raise

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)


class _Session:
    """Hands Strands the caller's client, so BedrockModel doesn't create its own from the default credentials."""

    def __init__(self, client: "BedrockRuntimeClient"):
        self.region_name = client.meta.region_name
        self._client = client

    def client(self, *args: Any, **kwargs: Any) -> _Client:
        return _Client(self._client)


# One BedrockModel per caller client and model.
@functools.lru_cache(maxsize=8)
def _model(bedrock: "BedrockRuntimeClient", model_id: str) -> BedrockModel:
    return BedrockModel(
        boto_session=_Session(bedrock),
        model_id=model_id,
        max_tokens=MAX_TOKENS,
        # Converse, not ConverseStream: the Step Functions task roles only allow bedrock:InvokeModel.
        streaming=False,
    )


def _schema_errors(schema: dict, value: Any) -> list[ValidationError]:
    return sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: list(error.absolute_path))


def _where(error: ValidationError) -> str:
    """The path and failed keyword of an error, without the value: values can repeat seller-supplied data."""
    return f"{'/'.join(str(part) for part in error.absolute_path) or '<root>'}: {error.validator}"


def _original(location: tuple, originals: dict[str, str]) -> str:
    return "/".join(originals.get(str(part), str(part)) for part in location) or "<root>"


class _Invalid(Exception):
    """An answer to ask again for. `feedback` goes to the model and can contain its values; it is never logged."""

    def __init__(self, feedback: str, log: dict):
        super().__init__(feedback)
        self.feedback = feedback
        self.log = log


async def _ask(
    model: BedrockModel, output_type: type[BaseModel], system_prompt: str, prompt: str, originals: dict[str, str]
) -> BaseModel:
    stop_reason = None
    usage = None
    result = None
    try:
        async for event in model.structured_output(
            output_type, [{"role": "user", "content": [{"text": prompt}]}], system_prompt=system_prompt
        ):
            if "stop" in event:
                stop_reason, _, usage, _ = event["stop"]
            result = event.get("output", result)
    except PydanticValidationError as e:
        if stop_reason in CONTENT_FILTER_STOP_REASONS:
            raise ContentFilteredError() from None
        # Strands builds the output model from the answer before this module sees it. The message has no values.
        errors = e.errors(include_input=False, include_url=False)
        # An extra key is the model's own text, so the log doesn't name it.
        where = sorted(
            {
                f"{'<extra key>' if error['type'] == 'extra_forbidden' else _original(error['loc'], originals)}: "
                f"{error['type']}"
                for error in errors
            }
        )
        raise _Invalid(
            "The answer does not match the schema: "
            + "; ".join(f"{_original(error['loc'], originals)}: {error['msg']}" for error in errors),
            {"errors": where},
        ) from None
    except ValueError:
        # Strands raises ValueError, with the stop reason in its message, when the model gave no answer.
        if stop_reason in CONTENT_FILTER_STOP_REASONS:
            raise ContentFilteredError() from None
        raise _Invalid("Answer with the structured output only.", {"stop_reason": stop_reason}) from None
    finally:
        if usage:
            logger.info({"usage": {"inputTokens": usage["inputTokens"], "outputTokens": usage["outputTokens"]}})
    if stop_reason in CONTENT_FILTER_STOP_REASONS:
        raise ContentFilteredError()
    if result is None:
        raise _Invalid("Answer with the structured output only.", {"stop_reason": stop_reason})
    return result


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
    """Return the model's answer to `prompt` as a dict with the original names that matches `schema`.

    `check` can reject an answer that matches the schema; the message it returns goes to the model with the retry,
    and is not logged.

    Raises:
        ContentFilteredError: A content filter or guardrail stopped the model.
        ModelResponseError: The answer still didn't match the schema after the retry, or was incomplete.
        ClientError: Bedrock rejected the request, unchanged, so callers can map throttling and retryable errors
            and see a ValidationException such as a schema too complex to compile.
    """
    keys = safe_keys(schema["properties"])
    originals = {key: original for original, key in keys.items()}
    output_type = output_model(schema, name, keys)
    model = _model(bedrock, model_id)
    # Claude 4.7 and later reject temperature.
    if supports_temperature(model_id):
        model.update_config(temperature=temperature)

    feedback = None
    for attempt in range(OUTPUT_RETRIES + 1):
        attempt_prompt = prompt if feedback is None else f"{prompt}\n\nYour previous answer was rejected. {feedback}"
        try:
            try:
                result = asyncio.run(_ask(model, output_type, system_prompt, attempt_prompt, originals))
            except _SchemaTooComplex as e:
                raise e.error from None
            except ModelThrottledException as e:
                if isinstance(e.__cause__, ClientError):
                    raise e.__cause__ from None
                raise
            answer = {originals[key]: value for key, value in result.model_dump(by_alias=True).items()}
            if errors := _schema_errors(schema, answer):
                raise _Invalid(
                    "The answer does not match the schema: " + "; ".join(error.message for error in errors),
                    {"errors": [_where(error) for error in errors]},
                )
            if check and (problem := check(answer)):
                raise _Invalid(problem, {"check_failed": True})
            return answer
        except _Invalid as e:
            logger.warning({"schema_mismatch": name, "attempt": attempt + 1, **e.log})
            feedback = e.feedback
    raise ModelResponseError(f"No valid {name} answer")
