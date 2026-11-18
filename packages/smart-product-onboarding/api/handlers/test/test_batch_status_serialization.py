# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json

import amzn_smart_product_onboarding_api_python_handlers  # noqa: F401  (installs the enum serialization shim)
from amzn_smart_product_onboarding_api_runtime.models import BatchExecution, StartBatchExecutionResponseContent


def test_start_batch_execution_response_serializes_status():
    body = StartBatchExecutionResponseContent(execution_id="abc", status="QUEUED")
    assert json.loads(body.to_json()) == {"executionId": "abc", "status": "QUEUED"}


def test_batch_execution_serializes_status():
    body = BatchExecution(execution_id="abc", created_at="2026-01-01", updated_at="2026-01-02", status="SUCCESS")
    assert json.loads(body.to_json())["status"] == "SUCCESS"
