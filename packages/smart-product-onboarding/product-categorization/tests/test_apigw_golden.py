# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The categorizeProduct and extractAttributes handlers must keep returning the responses they returned
through the generated API runtime used before.

golden/apigw_responses.json was recorded from that runtime for every case below (RECORD_GOLDEN=1). Do
not re-record it from the current handlers. Where the previous runtime crashed instead of answering, the
file records the exception, and the test states the response that replaced it.
"""

import importlib
import json
import os
import sys
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from amzn_smart_product_onboarding_core_utils.exceptions import (
    CONTENT_FILTERED_MESSAGE,
    ContentFilteredError,
    RateLimitError,
)
from amzn_smart_product_onboarding_core_utils.models import CategorizationPrediction

GOLDEN_PATH = Path(__file__).parent / "golden" / "apigw_responses.json"

_ENV = {
    "AWS_LAMBDA_FUNCTION_NAME": "test-function",
    "AWS_REGION": "us-east-1",
    "AWS_DEFAULT_REGION": "us-east-1",
    "CONFIG_BUCKET_NAME": "test-bucket",
    "CONFIG_PATHS_PARAM": "/test/config-paths",
    "BEDROCK_MODEL_ID": "env-var-model-id",
    "POWERTOOLS_TRACE_DISABLED": "1",
    "POWERTOOLS_METRICS_NAMESPACE": "test",
}
_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]
_CATEGORIZATION = "amzn_smart_product_onboarding_product_categorization.aws_lambda.categorization_apigw"
_EXTRACTION = "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction_apigw"

_TREE = {
    "10000637": {
        "id": "10000637",
        "name": "Sunglasses",
        "full_path": [{"id": "1", "name": "Accessories"}, {"id": "10000637", "name": "Sunglasses"}],
        "childs": [],
        "examples": [],
    }
}

PRODUCT = {"title": "Aviator Sunglasses", "description": "Polarized lenses", "metadata": "UV400"}


def _import(module_name):
    for name in [module_name, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(name, None)
    ssm = MagicMock()
    ssm.get_parameter.return_value = {
        "Parameter": {"Value": json.dumps({"categoryTree": "data/tree.json", "alwaysCategories": "data/always.json"})}
    }
    s3 = MagicMock()
    s3.get_object.side_effect = lambda **kwargs: {
        "Body": BytesIO(json.dumps({"data/tree.json": _TREE, "data/always.json": []}[kwargs["Key"]]).encode())
    }

    def client(service_name, **kwargs):
        return {"ssm": ssm, "s3": s3}.get(service_name, MagicMock())

    with (
        patch.dict(os.environ, _ENV),
        patch("boto3.client", side_effect=client),
        patch("boto3.resource", return_value=MagicMock()),
    ):
        for name in _BOTO3_HELPER_MODULES:
            importlib.import_module(name)
        return importlib.import_module(module_name)


def api_event(path, body):
    headers = {"Content-Type": "application/json"}
    return {
        "resource": path,
        "path": path,
        "httpMethod": "POST",
        "headers": headers,
        "multiValueHeaders": {k: [v] for k, v in headers.items()},
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": None,
        "stageVariables": None,
        "requestContext": {
            "requestId": "api-request-id",
            "resourcePath": path,
            "httpMethod": "POST",
            "stage": "prod",
            "path": f"/prod{path}",
            "identity": {"sourceIp": "127.0.0.1"},
        },
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


PREDICTION = CategorizationPrediction(
    predicted_category_id="10000637",
    predicted_category_name="Sunglasses",
    explanation="They are sunglasses.",
    prompt="the prompt",
)


def categorize(classify):
    def run():
        module = _import(_CATEGORIZATION)
        module.product_classifier.classify = classify
        return module

    return run


def extract(extracted=None, error=None, schema_error=None):
    def run():
        module = _import(_EXTRACTION)
        module.GPCSchemaRetriever = MagicMock(side_effect=schema_error) if schema_error else MagicMock()
        extractor = MagicMock()
        if error:
            extractor.extract_attributes.side_effect = error
        else:
            extractor.extract_attributes.return_value = extracted
        module.AttributesExtractor = MagicMock(return_value=extractor)
        return module

    return run


ATTRIBUTES = SimpleNamespace(
    attributes=[SimpleNamespace(name="Lens Type", value="Polarized"), SimpleNamespace(name="Frame", value="Metal")]
)

CASES = {
    "categorize: success": (
        categorize(MagicMock(return_value=PREDICTION)),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]}),
    ),
    "categorize: success with demo": (
        categorize(MagicMock(return_value=PREDICTION)),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"], "demo": True}),
    ),
    "categorize: retryable error": (
        categorize(MagicMock(side_effect=RateLimitError("slow down"))),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]}),
    ),
    "categorize: unexpected error": (
        categorize(MagicMock(side_effect=Exception("boom"))),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]}),
    ),
    "categorize: unknown category": (
        categorize(MagicMock(return_value=PREDICTION.model_copy(update={"predicted_category_id": "missing"}))),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]}),
    ),
    "extract: success": (
        extract(extracted=ATTRIBUTES),
        api_event("/extractAttributes", {"product": PRODUCT, "categoryId": "10000637"}),
    ),
    "extract: retryable error": (
        extract(error=RateLimitError("slow down")),
        api_event("/extractAttributes", {"product": PRODUCT, "categoryId": "10000637"}),
    ),
    "extract: unexpected error": (
        extract(error=Exception("boom")),
        api_event("/extractAttributes", {"product": PRODUCT, "categoryId": "10000637"}),
    ),
    "extract: schema unavailable": (
        extract(schema_error=Exception("no schema")),
        api_event("/extractAttributes", {"product": PRODUCT, "categoryId": "10000637"}),
    ),
}

# The previous runtime raised on these paths (it could not serialize a plain string body), so API
# Gateway answered 502. They now return the 500 response the handler intended.
REPLACED_CRASHES = {
    "categorize: retryable error": "Retryable error",
    "categorize: unexpected error": "Internal server error",
    "categorize: unknown category": "Internal server error",
    "extract: retryable error": "Retryable error",
    "extract: unexpected error": "Internal server error",
    "extract: schema unavailable": "Internal server error",
}


def invoke(name):
    setup, event = CASES[name]
    module = setup()
    with patch.dict(os.environ, _ENV):
        try:
            result = module.handler(event, lambda_context())
        except Exception as e:
            return {"raises": type(e).__name__}
    return {
        "statusCode": result["statusCode"],
        "headers": {k.lower(): v for k, v in (result.get("headers") or {}).items()},
        "multiValueHeaders": result.get("multiValueHeaders") or {},
        "body": json.loads(result["body"]) if result.get("body") else result.get("body"),
    }


@pytest.mark.skipif(not os.getenv("RECORD_GOLDEN"), reason="records the baseline from the previous runtime")
def test_record():
    recorded = {name: invoke(name) for name in CASES}
    GOLDEN_PATH.parent.mkdir(exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(recorded, indent=2, sort_keys=True) + "\n")


def expected(name, golden):
    if name in REPLACED_CRASHES:
        assert golden[name] == {"raises": "AttributeError"}
        return {
            "statusCode": 500,
            "headers": {
                "access-control-allow-headers": "*",
                "access-control-allow-origin": "*",
                "x-amzn-errortype": "InternalFailureError",
            },
            "multiValueHeaders": {},
            "body": {"message": REPLACED_CRASHES[name]},
        }
    return golden[name]


@pytest.mark.skipif(bool(os.getenv("RECORD_GOLDEN")), reason="recording")
@pytest.mark.parametrize("name", list(CASES))
def test_response_matches_previous_runtime(name):
    golden = json.loads(GOLDEN_PATH.read_text())
    assert invoke(name) == expected(name, golden)


# Added after the previous runtime, so there is no recorded baseline: a content filter stopping the model
# is the client's input, so it answers 400 with a message the website shows, never a retryable 500.
CONTENT_FILTERED_CASES = {
    "categorize: content filtered": (
        categorize(MagicMock(side_effect=ContentFilteredError())),
        api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]}),
    ),
    "extract: content filtered": (
        extract(error=ContentFilteredError()),
        api_event("/extractAttributes", {"product": PRODUCT, "categoryId": "10000637"}),
    ),
}


@pytest.mark.parametrize("name", list(CONTENT_FILTERED_CASES))
def test_content_filtered_returns_bad_request(name):
    setup, event = CONTENT_FILTERED_CASES[name]
    module = setup()
    with patch.dict(os.environ, _ENV):
        result = module.handler(event, lambda_context())
    assert result["statusCode"] == 400
    assert result["headers"] == {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "x-amzn-errortype": "BadRequestError",
    }
    assert json.loads(result["body"]) == {"message": CONTENT_FILTERED_MESSAGE}


def test_no_matching_category_returns_other():
    # Added after the previous runtime: the model may answer "other" when no candidate fits.
    no_match = CategorizationPrediction(
        predicted_category_id="other", predicted_category_name="Other", explanation="Not a product we list."
    )
    module = categorize(MagicMock(return_value=no_match))()
    event = api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]})
    with patch.dict(os.environ, _ENV):
        result = module.handler(event, lambda_context())
    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert (body["categoryId"], body["categoryName"], body["categoryPath"]) == ("other", "Other", "Other")
    assert body["explanation"] == "Not a product we list."


def test_categorize_debug_log_leaves_out_the_explanation():
    # The explanation can repeat seller-supplied product data.
    prediction = CategorizationPrediction(
        predicted_category_id="other", predicted_category_name="Other", explanation="Contact seller@example.com"
    )
    module = categorize(MagicMock(return_value=prediction))()
    event = api_event("/categorizeProduct", {"product": PRODUCT, "possibleCategories": ["10000637"]})
    with patch.dict(os.environ, _ENV), patch.object(module.logger, "debug") as debug:
        module.handler(event, lambda_context())
    assert debug.call_args_list
    assert all("seller@example.com" not in str(call) for call in debug.call_args_list)
