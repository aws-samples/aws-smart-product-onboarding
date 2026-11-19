# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
from types import SimpleNamespace

from amzn_smart_product_onboarding_api_common.handler import Response, api_handler
from amzn_smart_product_onboarding_api_common.models import BatchExecution, StartBatchExecutionResponseContent

CONTEXT = SimpleNamespace(
    function_name="test",
    memory_limit_in_mb=256,
    invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:test",
    aws_request_id="request-id",
)


def respond(body):
    return json.loads(api_handler("test")(lambda _request: Response.success(body))({}, CONTEXT)["body"])


def test_start_batch_execution_response_serializes_status():
    body = StartBatchExecutionResponseContent(execution_id="abc", status="QUEUED")
    assert respond(body) == {"executionId": "abc", "status": "QUEUED"}


def test_batch_execution_serializes_status():
    body = BatchExecution(execution_id="abc", created_at="2026-01-01", updated_at="2026-01-02", status="SUCCESS")
    assert respond(body)["status"] == "SUCCESS"
