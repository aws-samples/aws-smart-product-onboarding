# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
from types import SimpleNamespace

import pytest

os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "1")
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "test")

from amzn_smart_product_onboarding_api_common.handler import Response, api_handler  # noqa: E402
from amzn_smart_product_onboarding_api_common.models import (  # noqa: E402
    DownloadFileRequestContent,
    PresignedUrlResponse,
)

CONTEXT = SimpleNamespace(
    function_name="test",
    memory_limit_in_mb=256,
    invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:test",
    aws_request_id="request-id",
)
CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}


def event(body=None, path_parameters=None, query=None):
    return {
        "body": body if body is None or isinstance(body, str) else json.dumps(body),
        "pathParameters": path_parameters,
        "queryStringParameters": query,
        "requestContext": {"requestId": "api-request-id"},
    }


calls = []


@api_handler("download_file", DownloadFileRequestContent)
def download(request):
    calls.append(request)
    return Response.success(PresignedUrlResponse(url=f"https://example.com/{request.body.output_key}"))


@pytest.fixture(autouse=True)
def reset_calls():
    calls.clear()


def test_handler_takes_event_and_context():
    result = download(event({"outputKey": "a.csv"}), CONTEXT)
    assert result == {
        "statusCode": 200,
        "headers": CORS,
        "multiValueHeaders": {},
        "body": json.dumps({"url": "https://example.com/a.csv"}),
    }
    assert calls[0].body.output_key == "a.csv"


@pytest.mark.parametrize(
    "body",
    [None, "", "not json", "[]", {"expiration": 60}, {"outputKey": 7}, {"outputKey": "a", "expiration": 1}],
    ids=["missing", "empty", "not json", "array", "missing property", "wrong type", "out of range"],
)
def test_invalid_bodies_get_400_not_422(body):
    result = download(event(body), CONTEXT)
    assert result["statusCode"] == 400
    assert result["headers"] == {**CORS, "x-amzn-errortype": "BadRequestError"}
    assert json.loads(result["body"]) == {"message": "Invalid request body"}
    assert calls == []


@pytest.mark.parametrize(
    "response, status, error_type",
    [
        (Response.bad_request("bad"), 400, "BadRequestError"),
        (Response.not_authorized("no"), 403, "NotAuthorizedError"),
        (Response.not_found("missing"), 404, None),
        (Response.internal_failure("broken"), 500, "InternalFailureError"),
    ],
)
def test_error_responses(response, status, error_type):
    result = api_handler("op")(lambda _request: response)(event(), CONTEXT)
    assert result["statusCode"] == status
    assert result["headers"] == {**CORS, **({"x-amzn-errortype": error_type} if error_type else {})}
    assert json.loads(result["body"]) == response.body


def test_unhandled_errors_get_500():
    def fail(_request):
        raise RuntimeError("boom")

    result = api_handler("op")(fail)(event(), CONTEXT)
    assert result["statusCode"] == 500
    assert result["headers"]["x-amzn-errortype"] == "InternalFailureError"
    assert json.loads(result["body"]) == {"message": "Internal Error"}


def test_path_and_query_parameters_are_decoded():
    captured = []
    api_handler("op")(lambda request: captured.append(request) or Response.not_found("x"))(
        event(path_parameters={"executionId": "a%20b"}, query={"start_time": "2026-11-01T00%3A00"}), CONTEXT
    )
    assert captured[0].path_parameters == {"executionId": "a b"}
    assert captured[0].query_parameters == {"start_time": "2026-11-01T00:00"}


def test_response_bodies_omit_unset_optional_fields():
    result = api_handler("op")(lambda _request: Response.success(PresignedUrlResponse(url="u")))(event(), CONTEXT)
    assert json.loads(result["body"]) == {"url": "u"}
