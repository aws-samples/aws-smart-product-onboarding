# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The generateProduct API handler and the batch workflow's generate-product step."""

import importlib
import io
import json
import logging
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigSettings
from amzn_smart_product_onboarding_core_utils.exceptions import (
    CONTENT_FILTERED_MESSAGE,
    ContentFilteredError,
    ModelResponseError,
    RateLimitError,
)
from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_product_categorization.product_generator import BadRequestError, GeneratedProduct

_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]


def api_event(path, body):
    return {
        "resource": path,
        "path": path,
        "httpMethod": "POST",
        "headers": {"Content-Type": "application/json", "Authorization": "token"},
        "requestContext": {"requestId": "api-request-id", "resourcePath": path, "httpMethod": "POST"},
        "body": json.dumps(body),
        "isBase64Encoded": False,
    }


def lambda_context():
    return SimpleNamespace(
        function_name="test",
        memory_limit_in_mb=1024,
        invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:test",
        aws_request_id="lambda-request-id",
    )


# The status codes, headers and bodies the TypeScript handler returned, recorded for each case below. Do not
# regenerate this file from the current handler: it is the baseline the handler must keep matching.
GOLDEN_PATH = Path(__file__).parent / "golden" / "generate_product_responses.json"

_API = "amzn_smart_product_onboarding_product_categorization.aws_lambda.generate_product_apigw"
_SFN = "amzn_smart_product_onboarding_product_categorization.aws_lambda.generate_product"
_ENV = {
    "AWS_LAMBDA_FUNCTION_NAME": "test-function",
    "AWS_REGION": "us-east-1",
    "AWS_DEFAULT_REGION": "us-east-1",
    "IMAGE_BUCKET": "images",
    "BEDROCK_MODEL_ID": "env-model",
    "POWERTOOLS_TRACE_DISABLED": "1",
    "POWERTOOLS_METRICS_NAMESPACE": "test",
}
PRODUCT = GeneratedProduct(title="T", description="D", usage={"inputTokens": 10, "outputTokens": 20})


def _bedrock_error(code):
    return ClientError({"Error": {"Code": code, "Message": "bedrock says no"}}, "Converse")


def _load(module_name, generate=None, config=None):
    """Import the handler with fake AWS clients, a fake AppConfig answer and a fake ProductGenerator."""
    for name in [module_name, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(name, None)
    with patch.dict(os.environ, _ENV), patch("boto3.client", return_value=MagicMock()):
        for name in _BOTO3_HELPER_MODULES:
            importlib.import_module(name)
        module = importlib.import_module(module_name)
    module.appconfig_client = MagicMock()
    module.appconfig_client.get_configuration.return_value = config
    generator = MagicMock()
    if isinstance(generate, BaseException) or (isinstance(generate, type) and issubclass(generate, BaseException)):
        generator.generate.side_effect = generate
    else:
        generator.generate.return_value = generate or PRODUCT
    module.ProductGenerator = MagicMock(return_value=generator)
    return module, generator


def _call_api(module, body, env=None):
    with patch.dict(os.environ, {k: v for k, v in {**_ENV, **(env or {})}.items() if v is not None}, clear=True):
        result = module.handler(api_event("/generateProduct", body), lambda_context())
    return {
        "statusCode": result["statusCode"],
        "headers": {k.lower(): v for k, v in result["headers"].items()},
        "body": json.loads(result["body"]),
    }


# API: responses


IMAGE = {"productImages": ["image1.jpg"]}
GOLDEN_CASES = {
    "success": ({}, IMAGE, None),
    "temperature out of range": ({}, {**IMAGE, "temperature": 1.5}, None),
    "image bucket not configured": ({}, IMAGE, {"IMAGE_BUCKET": None}),
    "bedrock validation error": ({"generate": _bedrock_error("ValidationException")}, IMAGE, None),
    "bedrock resource not found": ({"generate": _bedrock_error("ResourceNotFoundException")}, IMAGE, None),
    "bedrock throttling": ({"generate": RateLimitError("slow down")}, IMAGE, None),
    "invalid input": ({"generate": BadRequestError("Image image1.jpg is not a supported format")}, IMAGE, None),
    "unexpected error": ({"generate": Exception("boom")}, IMAGE, None),
}
# "success without usage" isn't here: Converse always returns the usage, and the handler adds it up over attempts.


@pytest.mark.parametrize("name", list(GOLDEN_CASES))
def test_api_responses_match_the_previous_handler(name):
    load, body, env = GOLDEN_CASES[name]
    module, _ = _load(_API, **load)
    golden = json.loads(GOLDEN_PATH.read_text())[name]

    assert _call_api(module, body, env) == {k: golden[k] for k in ("statusCode", "headers", "body")}


def test_an_appconfig_failure_is_an_internal_error():
    module, _ = _load(_API)
    module.appconfig_client.get_configuration.side_effect = Exception("AppConfig down")
    golden = json.loads(GOLDEN_PATH.read_text())["configuration error"]

    assert _call_api(module, IMAGE) == {k: golden[k] for k in ("statusCode", "headers", "body")}


def test_a_content_filtered_generation_is_a_bad_request_with_its_message():
    module, _ = _load(_API, generate=ContentFilteredError())

    response = _call_api(module, IMAGE)

    assert (response["statusCode"], response["body"]) == (400, {"message": CONTENT_FILTERED_MESSAGE})
    assert response["headers"]["x-amzn-errortype"] == "BadRequestError"


def test_an_image_that_cant_be_read_is_an_internal_error():
    module, _ = _load(_API, generate=ClientError({"Error": {"Code": "AccessDenied", "Message": "no"}}, "GetObject"))

    response = _call_api(module, IMAGE)

    assert (response["statusCode"], response["body"]) == (500, {"message": "Internal server error"})


def test_a_model_response_error_is_an_internal_error():
    module, _ = _load(_API, generate=ModelResponseError("No valid product answer"))

    assert _call_api(module, IMAGE)["statusCode"] == 500


# API: options


def test_the_request_options_reach_the_generator():
    module, generator = _load(_API, config=AppConfigSettings(model_id="config-model", temperature=0.5))
    body = {
        "productImages": ["a.jpg", "b.png"],
        "language": "Chilean Spanish",
        "descriptionLength": "short",
        "metadata": "Brand: Acme",
        "model": "global.amazon.nova-2-lite-v1:0",
        "temperature": 0.3,
        "examples": [{"title": "Lamp", "description": "Warm.", "shortDescription": "s", "metadata": "m"}],
    }

    assert _call_api(module, body)["statusCode"] == 200

    generator.generate.assert_called_once_with(
        image_keys=["a.jpg", "b.png"],
        model_id="global.amazon.nova-2-lite-v1:0",
        temperature=0.3,
        language="Chilean Spanish",
        description_length="short",
        metadata="Brand: Acme",
        examples=[{"title": "Lamp", "description": "Warm."}],
    )


def test_options_the_request_leaves_out_come_from_appconfig_not_the_openapi_defaults():
    # The OpenAPI definition gives defaults (English, medium, temperature 0.7, Claude Haiku 5.5) that the
    # previous handler never applied: the website leaves the model out to use the deployment's model.
    module, generator = _load(_API, config=AppConfigSettings(model_id="config-model", temperature=0.5))

    _call_api(module, IMAGE)

    generator.generate.assert_called_once_with(
        image_keys=["image1.jpg"],
        model_id="config-model",
        temperature=0.5,
        language=None,
        description_length=None,
        metadata=None,
        examples=[],
    )


def test_without_appconfig_the_function_defaults_apply():
    module, generator = _load(_API)

    _call_api(module, IMAGE)

    kwargs = generator.generate.call_args.kwargs
    assert (kwargs["model_id"], kwargs["temperature"]) == ("env-model", 0.1)


# Batch workflow step


def _call_sfn(module, event):
    with patch.dict(os.environ, _ENV):
        return module.handler(event, lambda_context())


def test_the_step_returns_the_product_and_applies_the_image_prefix():
    module, generator = _load(_SFN)

    result = _call_sfn(module, {"images": ["front.jpg", "side.jpg"], "metadata": "Brand: Acme", "prefix": "run-1"})

    assert result == {"title": "T", "description": "D"}
    generator.generate.assert_called_once_with(
        image_keys=["run-1/front.jpg", "run-1/side.jpg"],
        model_id="env-model",
        temperature=0.1,
        language=None,
        description_length="medium",
        metadata="Brand: Acme",
        examples=None,
    )
    module.ProductGenerator.assert_called_once_with(
        module.LAMBDA_BEDROCK_RUNTIME_CLIENT, module.LAMBDA_S3_CLIENT, "images"
    )


def test_the_step_uses_every_appconfig_option():
    examples = [{"title": "Lamp", "description": "Warm."}]
    config = AppConfigSettings(
        model_id="config-model", temperature=0.4, language="German", description_length="long", examples=examples
    )
    module, generator = _load(_SFN, config=config)

    _call_sfn(module, {"images": ["front.jpg"]})

    generator.generate.assert_called_once_with(
        image_keys=["front.jpg"],
        model_id="config-model",
        temperature=0.4,
        language="German",
        description_length="long",
        metadata=None,
        examples=examples,
    )


@pytest.mark.parametrize(
    "error",
    [
        RateLimitError("slow down"),
        ModelResponseError("No valid product answer"),
        ContentFilteredError(),
        ClientError({"Error": {"Code": "NoSuchKey", "Message": "missing"}}, "GetObject"),
    ],
    ids=lambda e: type(e).__name__,
)
def test_the_step_raises_errors_for_the_state_machine_by_name(error):
    # The state machine retries RateLimitError, RetryableError and ModelResponseError, and catches
    # ContentFilteredError, by the error's class name.
    module, _ = _load(_SFN, generate=error)

    with pytest.raises(type(error)) as raised:
        _call_sfn(module, {"images": ["front.jpg"]})
    assert raised.value is error


def test_the_step_logs_the_usage_but_not_the_product(caplog):
    module, _ = _load(
        _SFN, generate=GeneratedProduct("SELLER TITLE", "SELLER TEXT", {"inputTokens": 1, "outputTokens": 2})
    )

    with caplog.at_level(logging.DEBUG):
        _call_sfn(module, {"images": ["front.jpg"], "metadata": "SELLER METADATA"})

    assert "inputTokens" in caplog.text
    assert "SELLER" not in caplog.text


# API: request validation and logging


def _raw_event(body):
    event = api_event("/generateProduct", None)
    event["body"] = body
    return event


@pytest.mark.parametrize(
    "body",
    [
        "not json",
        None,
        json.dumps({"language": "English"}),
        json.dumps({"productImages": "a"}),
        json.dumps({"productImages": ["a"], "model": "unknown-model"}),
    ],
    ids=["not JSON", "no body", "no productImages", "productImages not a list", "unknown model"],
)
def test_an_invalid_body_is_a_bad_request_and_generates_nothing(body):
    module, generator = _load(_API)

    with patch.dict(os.environ, _ENV):
        result = module.handler(_raw_event(body), lambda_context())

    assert (result["statusCode"], json.loads(result["body"])) == (400, {"message": "Invalid request body"})
    assert result["headers"]["x-amzn-errortype"] == "BadRequestError"
    generator.generate.assert_not_called()


def test_the_api_logs_no_headers_or_authorizer_claims(caplog):
    from amzn_smart_product_onboarding_api_common.handler import logger as api_logger

    token = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln"
    email = "someone@example.com"
    event = api_event("/generateProduct", IMAGE)
    event["headers"]["Authorization"] = token
    event["requestContext"]["authorizer"] = {"claims": {"email": email}}
    module, _ = _load(_API)
    buffer = io.StringIO()
    stream = api_logger.registered_handler.setStream(buffer)
    level = api_logger.log_level
    api_logger.setLevel("DEBUG")
    try:
        with caplog.at_level(logging.DEBUG), patch.dict(os.environ, _ENV):
            assert module.handler(event, lambda_context())["statusCode"] == 200
    finally:
        api_logger.setLevel(level)
        api_logger.registered_handler.setStream(stream)

    output = buffer.getvalue() + caplog.text
    assert "Start GenerateProduct Operation" in output
    for secret in (token, email, "Authorization", "claims"):
        assert secret not in output
