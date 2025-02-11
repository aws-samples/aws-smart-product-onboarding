# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
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
    RateLimitError,
    RetryableError,
    ModelResponseError,
)
from amzn_smart_product_onboarding_core_utils.logger import logger

if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_bedrock_runtime import (
        BedrockRuntimeClient,
        MessageTypeDef,
        MessageOutputTypeDef,
        ConverseResponseTypeDef,
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
        sts = boto3.client(
            "sts", config=Config(retries={"max_attempts": 3, "mode": "adaptive"})
        )

        response = sts.assume_role(
            RoleArn=BEDROCK_XACCT_ROLE,
            RoleSessionName="x-acct-role-for-smart-product-onboarding",
        )

        client_kwargs["aws_access_key_id"] = response["Credentials"]["AccessKeyId"]
        client_kwargs["aws_secret_access_key"] = response["Credentials"][
            "SecretAccessKey"
        ]
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
) -> "ConverseResponseTypeDef":
    if response_open:
        messages.append(
            {
                "role": "assistant",
                "content": [{"text": response_open}],
            },
        )
    inference_config = {
        "temperature": 0,
        "stopSequences": [],
    }
    if response_close:
        inference_config["stopSequences"].append(response_close)

    response = bedrock.converse(
        modelId=model_id,
        messages=messages,
        inferenceConfig=inference_config,
    )
    logger.info({"usage": response["usage"]})
    return response


def extract_response_text(response: dict) -> str:
    try:
        return response["output"]["message"]["content"][0]["text"]
    except KeyError:
        logger.error(f"Failed to get prediction from response: {response}")
        raise ModelResponseError("Failed to get prediction from response")


def build_full_response(
    response: dict, response_open: str = "", response_close: str = ""
) -> str:
    text = extract_response_text(response)
    if response["stopReason"] == "stop_sequence":
        return response_open + text + response_close
    elif response["stopReason"] == "end_turn" and text.endswith(response_close):
        return response_open + text
    else:
        logger.error(
            {
                "stopReason": response["stopReason"],
                "text": text,
                "response_open": response_open,
                "response_close": response_close,
            }
        )
        raise ModelResponseError(response["stopReason"])
