# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The API handlers must log request metadata only, never headers or authorizer claims."""

import io
import json
import os
from types import SimpleNamespace

import pytest

os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "1")
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "test")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

from amzn_smart_product_onboarding_api_common.handler import logger  # noqa: E402

from amzn_smart_product_onboarding_api_python_handlers import (  # noqa: E402
    create_batch_execution,
    download_file,
    get_batch_execution,
    list_batch_executions,
    upload_file,
)

TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXN1YiJ9.c2lnbmF0dXJl"
EMAIL = "someone@example.com"
SOURCE_IP = "198.51.100.7"
REQUEST_ID = "11111111-2222-3333-4444-555555555555"
SECRETS = [TOKEN, EMAIL, SOURCE_IP, "Authorization", "test-sub", "claims"]


def api_event(body=None, path_parameters=None):
    headers = {"Authorization": TOKEN, "Content-Type": "application/json", "X-Forwarded-For": SOURCE_IP}
    return {
        "httpMethod": "POST",
        "resource": "/test",
        "headers": headers,
        "multiValueHeaders": {k: [v] for k, v in headers.items()},
        "queryStringParameters": None,
        "multiValueQueryStringParameters": None,
        "pathParameters": path_parameters,
        "requestContext": {
            "requestId": REQUEST_ID,
            "authorizer": {"claims": {"sub": "test-sub", "email": EMAIL, "cognito:username": "test-sub"}},
            "identity": {"sourceIp": SOURCE_IP},
        },
        "body": json.dumps(body) if body is not None else None,
        "isBase64Encoded": False,
    }


def lambda_context():
    return SimpleNamespace(
        function_name="test",
        memory_limit_in_mb=128,
        invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:test",
        aws_request_id="lambda-request-id",
    )


CASES = [
    # Each handler returns before calling AWS because its required setting is unset.
    (upload_file, "INPUT_BUCKET_NAME", api_event({"fileName": "products.csv"})),
    (download_file, "OUTPUT_BUCKET_NAME", api_event({"outputKey": "results/products.csv"})),
    (create_batch_execution, "CATEGORIZATION_MACHINE", api_event({"inputFile": "uploads/products.csv"})),
    (get_batch_execution, "SESSION_TABLE", api_event(path_parameters={"executionId": "abc"})),
    (list_batch_executions, "SESSION_TABLE", api_event()),
]


@pytest.fixture
def log_output():
    """Capture the handler logger's output at DEBUG level."""
    buffer = io.StringIO()
    handler = logger.registered_handler
    stream = handler.setStream(buffer)
    level = logger.log_level
    logger.setLevel("DEBUG")
    yield buffer
    logger.setLevel(level)
    handler.setStream(stream)


@pytest.mark.parametrize("module, unset_setting, event", CASES, ids=lambda c: getattr(c, "__name__", ""))
def test_handler_logs_no_headers_or_claims(module, unset_setting, event, monkeypatch, log_output):
    monkeypatch.setattr(module, unset_setting, None)

    module.handler(event, lambda_context())

    output = log_output.getvalue()
    assert "operation" in output
    assert REQUEST_ID in output
    for secret in SECRETS:
        assert secret not in output


def test_upload_file_success_logs_no_headers_or_claims(monkeypatch, log_output):
    monkeypatch.setattr(upload_file, "INPUT_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")

    response = upload_file.handler(api_event({"fileName": "products.csv"}), lambda_context())

    assert response["statusCode"] == 200
    output = log_output.getvalue()
    assert "products.csv" in output
    for secret in SECRETS:
        assert secret not in output
