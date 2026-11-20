# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
import re
from typing import TYPE_CHECKING, Union

import boto3
import botocore.exceptions
from botocore.config import Config
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from amzn_smart_product_onboarding_core_utils.exceptions import (
    ContentFilteredError,
    ModelResponseError,
    RateLimitError,
    RetryableError,
)
from amzn_smart_product_onboarding_core_utils.logger import logger

# Converse stop reasons for a request or response that a content filter or guardrail blocked.
CONTENT_FILTER_STOP_REASONS = ("content_filtered", "guardrail_intervened")

if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_bedrock_runtime import (
        BedrockRuntimeClient,
        ConverseResponseTypeDef,
        MessageOutputTypeDef,
        MessageTypeDef,
    )
else:
    BedrockRuntimeClient = object

BEDROCK_XACCT_ROLE = os.getenv("BEDROCK_XACCT_ROLE")
BEDROCK_XACCT_REGION = os.getenv(
    "BEDROCK_XACCT_REGION", "us-west-2"
)  # we assume cross-account role happens in PDX by default

if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    client_kwargs = {"region_name": os.getenv("AWS_REGION", "us-east-1")}

    if BEDROCK_XACCT_ROLE:
        sts = boto3.client("sts", config=Config(retries={"max_attempts": 3, "mode": "adaptive"}))

        response = sts.assume_role(
            RoleArn=BEDROCK_XACCT_ROLE,
            RoleSessionName="x-acct-role-for-smart-product-onboarding",
        )

        client_kwargs["aws_access_key_id"] = response["Credentials"]["AccessKeyId"]
        client_kwargs["aws_secret_access_key"] = response["Credentials"]["SecretAccessKey"]
        client_kwargs["aws_session_token"] = response["Credentials"]["SessionToken"]

        # x-acct region
        client_kwargs["region_name"] = BEDROCK_XACCT_REGION

    retry_config = Config(
        region_name=client_kwargs["region_name"],
        connect_timeout=120,
        read_timeout=120,
        retries={
            "max_attempts": 10,
            "mode": "adaptive",
        },
    )

    LAMBDA_BEDROCK_RUNTIME_CLIENT: "BedrockRuntimeClient" = boto3.client(
        "bedrock-runtime", config=retry_config, **client_kwargs
    )
else:
    LAMBDA_BEDROCK_RUNTIME_CLIENT = object


def handle_bedrock_client_error(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except botocore.exceptions.ClientError as error:
            if error.response["Error"]["Code"] == "ThrottlingException":
                logger.error(error.response["Error"]["Code"])
                raise RateLimitError(error)
            elif error.response["Error"]["Code"] in (
                "ModelTimeoutException",
                "InternalServerException",
                "ServiceUnavailableException",
            ):
                logger.exception(error)
                raise RetryableError(error)
            raise

    return wrapper


_INFERENCE_PROFILE_PREFIXES = ("us.", "us-gov.", "eu.", "apac.", "jp.", "au.", "ca.", "global.")


def ensure_cross_region_profile(model_id: str) -> str:
    """Prefix a bare foundation model ID with the US geo inference profile; leave profile IDs (us., global., ...) alone."""
    return model_id if model_id.startswith(_INFERENCE_PROFILE_PREFIXES) else "us." + model_id


@retry(
    retry=retry_if_exception_type(RateLimitError),
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(multiplier=2, max=60, min=30),
    reraise=True,
)
@handle_bedrock_client_error
def get_model_response(
    bedrock: "BedrockRuntimeClient",
    model_id: str,
    messages: list[Union["MessageTypeDef", "MessageOutputTypeDef"]],
    response_open: str = None,
    response_close: str = None,
    temperature: float = 0,
) -> "ConverseResponseTypeDef":
    messages, inference_config = prepare_converse_request(
        model_id, messages, response_open, response_close, temperature
    )

    response = bedrock.converse(
        modelId=model_id,
        messages=messages,
        inferenceConfig=inference_config,
    )
    logger.info({"usage": response["usage"]})
    return response


_CLAUDE_VERSION = re.compile(r"anthropic\.claude-[a-z]+-(\d+)(?:-(\d{1,2}))?(?=[-:]|$)")


def _claude_version(model_id: str) -> tuple[int, int] | None:
    """Return (major, minor) for Claude IDs named claude-<family>-<major>[-<minor>], else None."""
    match = _CLAUDE_VERSION.search(model_id)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2) or 0)


def supports_prefill(model_id: str) -> bool:
    """Claude 4.6 and later reject a final assistant message (prefill)."""
    version = _claude_version(model_id)
    return version is None or version < (4, 6)


def supports_temperature(model_id: str) -> bool:
    """Claude 4.7 and later reject the temperature inference parameter."""
    version = _claude_version(model_id)
    return version is None or version < (4, 7)


def prepare_converse_request(
    model_id: str,
    messages: list[Union["MessageTypeDef", "MessageOutputTypeDef"]],
    response_open: str | None = None,
    response_close: str | None = None,
    temperature: float = 0,
) -> tuple[list, dict]:
    """Build Converse messages and inferenceConfig, dropping prefill and temperature for models that reject them."""
    messages = list(messages)
    if response_open and supports_prefill(model_id):
        messages.append({"role": "assistant", "content": [{"text": response_open}]})
    inference_config: dict = {"stopSequences": [response_close] if response_close else []}
    if supports_temperature(model_id):
        inference_config["temperature"] = temperature
    return messages, inference_config


def _response_anchor(response_open: str) -> str:
    """The start marker to look for when the model writes the opening itself: the first XML tag, or '{'."""
    if response_open.startswith("<"):
        return response_open[: response_open.index(">") + 1]
    return response_open[:1]


def complete_response(
    text: str,
    stop_reason: str,
    model_id: str,
    response_open: str = "",
    response_close: str = "",
) -> str | None:
    """
    Rebuild the full structured response from the model's text.

    With prefill the model continues after response_open. Without prefill it writes the opening itself,
    so any preamble before the opening marker is dropped. Returns None if the response is incomplete.
    """
    if response_open and not supports_prefill(model_id):
        start = text.find(_response_anchor(response_open))
        if start == -1:
            return None
        text = text[start:]
        prefix = ""
    else:
        prefix = response_open
    if stop_reason == "stop_sequence":
        return prefix + text + response_close
    if stop_reason == "end_turn" and text.endswith(response_close):
        return prefix + text
    return None


def extract_response_text(response: dict) -> str:
    """Return the first text block. Reasoning models put a reasoningContent block before it.

    Raises ContentFilteredError first when a content filter or guardrail stopped the model, because the
    response then has no usable text, or none at all.
    """
    if response.get("stopReason") in CONTENT_FILTER_STOP_REASONS:
        logger.warning({"stopReason": response["stopReason"]})
        raise ContentFilteredError()
    try:
        return next(block["text"] for block in response["output"]["message"]["content"] if "text" in block)
    except (KeyError, StopIteration):
        logger.error(f"Failed to get prediction from response: {response}")
        raise ModelResponseError("Failed to get prediction from response")


def build_full_response(response: dict, response_open: str = "", response_close: str = "", model_id: str = "") -> str:
    text = extract_response_text(response)
    full = complete_response(text, response["stopReason"], model_id, response_open, response_close)
    if full is None:
        logger.error(
            {
                "stopReason": response["stopReason"],
                "text": text,
                "response_open": response_open,
                "response_close": response_close,
            }
        )
        raise ModelResponseError(response["stopReason"])
    return full


def json_output_config(schema: dict, name: str) -> dict:
    """Converse outputConfig that constrains the model's text to match a JSON schema."""
    return {
        "textFormat": {
            "type": "json_schema",
            "structure": {"jsonSchema": {"schema": json.dumps(schema), "name": name}},
        }
    }


def parse_json_response(response: dict) -> dict:
    """Return the JSON object from a structured-output response.

    Raises ContentFilteredError for a filtered response and ModelResponseError when the model stopped
    before finishing the JSON (max_tokens, malformed_model_output) or returned something that does not parse.
    """
    # The text can repeat seller-supplied product data, so only its length is logged.
    text = extract_response_text(response)
    if response["stopReason"] != "end_turn":
        logger.error({"stopReason": response["stopReason"], "text_length": len(text)})
        raise ModelResponseError(response["stopReason"])
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error({"error": str(e), "text_length": len(text)})
        raise ModelResponseError("Response is not valid JSON") from e
