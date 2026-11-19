# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The metaclass handler must keep returning the responses it returned through the PDK-generated runtime.

golden/apigw_responses.json was recorded from that runtime for every case below (RECORD_GOLDEN=1). Do
not re-record it from the current handler. Where the previous runtime crashed instead of answering, the
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

GOLDEN_PATH = Path(__file__).parent / "golden" / "apigw_responses.json"

_ENV = {
    "AWS_LAMBDA_FUNCTION_NAME": "test-function",
    "AWS_REGION": "us-east-1",
    "AWS_DEFAULT_REGION": "us-east-1",
    "CONFIG_BUCKET_NAME": "test-bucket",
    "CONFIG_PATHS_PARAM": "/test/config-paths",
    "POWERTOOLS_TRACE_DISABLED": "1",
    "POWERTOOLS_METRICS_NAMESPACE": "test",
}
_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.dynamodb_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]
_HANDLER = "amzn_smart_product_onboarding_metaclasses.aws_lambda_apigw"


class _FakeClientError(Exception):
    pass


def _import():
    for name in [_HANDLER, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(name, None)
    ssm = MagicMock()
    ssm.get_parameter.return_value = {
        "Parameter": {
            "Value": json.dumps(
                {
                    "wordMap": "data/word_map.json",
                    "categoryVectors": "data/category_vectors.json",
                    "language": "english",
                    "wordEmbeddingsTable": "word-embeddings-table",
                }
            )
        }
    }
    s3 = MagicMock()
    s3.get_object.side_effect = lambda **kwargs: {
        "Body": BytesIO(
            json.dumps(
                {
                    "data/word_map.json": {"word": ["cat1"]},
                    "data/category_vectors.json": {"cat1": [0.1] * 300},
                }.get(kwargs["Key"], [])
            ).encode()
        )
    }
    s3.exceptions.ClientError = _FakeClientError

    def client(service_name, **kwargs):
        return {"ssm": ssm, "s3": s3}.get(service_name, MagicMock())

    with (
        patch.dict(os.environ, _ENV),
        patch("boto3.client", side_effect=client),
        patch("boto3.resource", return_value=MagicMock()),
    ):
        for name in _BOTO3_HELPER_MODULES:
            importlib.import_module(name)
        return importlib.import_module(_HANDLER)


def api_event(body):
    headers = {"Content-Type": "application/json"}
    return {
        "resource": "/metaclass",
        "path": "/metaclass",
        "httpMethod": "POST",
        "headers": headers,
        "multiValueHeaders": {k: [v] for k, v in headers.items()},
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": None,
        "stageVariables": None,
        "requestContext": {
            "requestId": "api-request-id",
            "resourcePath": "/metaclass",
            "httpMethod": "POST",
            "stage": "prod",
            "path": "/prod/metaclass",
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


def prediction(with_findings=True):
    from amzn_smart_product_onboarding_core_utils.models import MetaclassPrediction, WordFinding

    return MetaclassPrediction(
        possible_categories=["10000637", "10000638"],
        clean_title="aviator sunglasses",
        findings=[WordFinding(position=0, type="metaclass", word="sunglasses", score=0.9)] if with_findings else [],
    )


PRODUCT = {"title": "Aviator Sunglasses", "description": "Polarized lenses"}
CASES = {
    "metaclass: success": ({"product": PRODUCT}, lambda: prediction()),
    "metaclass: success with demo": ({"product": PRODUCT, "demo": True}, lambda: prediction()),
    "metaclass: success with demo and no findings": (
        {"product": PRODUCT, "demo": True},
        lambda: prediction(with_findings=False),
    ),
    "metaclass: classifier error": ({"product": PRODUCT}, None),
}

# The previous runtime raised on these paths, so API Gateway answered 502. With findings, the response
# model rejected the classifier's finding objects; the handler then returned a plain string body, which
# the runtime could not serialize. They now return the response the handler intended.
REPLACED_CRASHES = {
    "metaclass: classifier error": (500, {"message": "Internal server error"}),
    "metaclass: success with demo": (
        200,
        {
            "possibleCategories": ["10000637", "10000638"],
            "cleanTitle": "aviator sunglasses",
            "findings": [{"position": 0, "type": "metaclass", "word": "sunglasses", "score": 0.9}],
        },
    ),
}


def invoke(name):
    body, result = CASES[name]
    module = _import()
    module.metaclass_classifier.classify = (
        MagicMock(return_value=result()) if result else MagicMock(side_effect=Exception("boom"))
    )
    with patch.dict(os.environ, _ENV):
        try:
            response = module.handler(api_event(body), lambda_context())
        except Exception as e:
            return {"raises": type(e).__name__}
    return {
        "statusCode": response["statusCode"],
        "headers": {k.lower(): v for k, v in (response.get("headers") or {}).items()},
        "multiValueHeaders": response.get("multiValueHeaders") or {},
        "body": json.loads(response["body"]) if response.get("body") else response.get("body"),
    }


@pytest.mark.skipif(not os.getenv("RECORD_GOLDEN"), reason="records the baseline from the previous runtime")
def test_record():
    recorded = {name: invoke(name) for name in CASES}
    GOLDEN_PATH.parent.mkdir(exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(recorded, indent=2, sort_keys=True) + "\n")


def expected(name, golden):
    if name in REPLACED_CRASHES:
        assert golden[name] == {"raises": "AttributeError"}
        status, body = REPLACED_CRASHES[name]
        return {
            "statusCode": status,
            "headers": {
                "access-control-allow-headers": "*",
                "access-control-allow-origin": "*",
                **({"x-amzn-errortype": "InternalFailureError"} if status == 500 else {}),
            },
            "multiValueHeaders": {},
            "body": body,
        }
    return golden[name]


@pytest.mark.skipif(bool(os.getenv("RECORD_GOLDEN")), reason="recording")
@pytest.mark.parametrize("name", list(CASES))
def test_response_matches_previous_runtime(name):
    golden = json.loads(GOLDEN_PATH.read_text())
    assert invoke(name) == expected(name, golden)
