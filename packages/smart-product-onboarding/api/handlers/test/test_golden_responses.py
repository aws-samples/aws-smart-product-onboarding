# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The API handlers must keep returning the responses they returned through the PDK-generated runtime.

golden/responses.json was recorded from that runtime for every case below (RECORD_GOLDEN=1). Do not
re-record it from the current handlers: it is the baseline they must keep matching. Where the previous
runtime crashed instead of answering, the file records the exception, and the test states the response
that replaced it.
"""

import json
import os
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import botocore.exceptions
import pytest

os.environ.setdefault("POWERTOOLS_TRACE_DISABLED", "1")
os.environ.setdefault("POWERTOOLS_METRICS_NAMESPACE", "test")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

from amzn_smart_product_onboarding_api_python_handlers import (  # noqa: E402
    create_batch_execution,
    download_file,
    get_batch_execution,
    list_batch_executions,
    upload_file,
)

GOLDEN_PATH = Path(__file__).parent / "golden" / "responses.json"
PRESIGNED_URL = "https://bucket.s3.amazonaws.com/uploads/key?X-Amz-Signature=sig"
SESSION_ID = "00000000-0000-4000-8000-000000000001"
USERNAME = "test-user"

# Responses that the previous runtime failed to produce. It raised instead, and API Gateway answered 502.
REPLACED_CRASHES = {
    "create: put_item fails": {
        "statusCode": 500,
        "body": {"message": "Internal Error"},
        "sessionItem": {
            "input": {"compressed_images_file": None, "input_file": "uploads/p.csv"},
            "session_id": SESSION_ID,
            "status": "QUEUED",
            "type": "Session",
        },
    },
}

# Responses that the previous runtime returned without a body.
REPLACED_EMPTY_BODIES = {
    "get: not found": {"message": "Execution not found"},
}


def api_event(path, method="POST", body=None, path_parameters=None, query=None, username=USERNAME):
    headers = {"Content-Type": "application/json"}
    return {
        "resource": path,
        "path": path,
        "httpMethod": method,
        "headers": headers,
        "multiValueHeaders": {k: [v] for k, v in headers.items()},
        "queryStringParameters": query,
        "multiValueQueryStringParameters": {k: [v] for k, v in query.items()} if query else None,
        "pathParameters": path_parameters,
        "stageVariables": None,
        "requestContext": {
            "requestId": "api-request-id",
            "resourcePath": path,
            "httpMethod": method,
            "stage": "prod",
            "path": f"/prod{path}",
            "authorizer": {"claims": {"cognito:username": username}} if username else {},
            "identity": {"sourceIp": "127.0.0.1"},
        },
        "body": json.dumps(body) if isinstance(body, dict) else body,
        "isBase64Encoded": False,
    }


def lambda_context():
    return SimpleNamespace(
        function_name="test",
        memory_limit_in_mb=256,
        invoked_function_arn="arn:aws:lambda:us-east-1:000000000000:function:test",
        aws_request_id="lambda-request-id",
    )


def fake_s3(fail=False):
    s3 = MagicMock()
    if fail:
        s3.generate_presigned_url.side_effect = botocore.exceptions.ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "denied"}}, "GeneratePresignedUrl"
        )
    else:
        s3.generate_presigned_url.return_value = PRESIGNED_URL
    return s3


def batch_item(status="SUCCESS", **extra):
    return {
        "session_id": SESSION_ID,
        "type": "Session",
        "status": status,
        "created_at": "2026-11-01T10:00:00+00:00",
        "updated_at": "2026-11-01T10:05:00+00:00",
        "date": "2026-11-01",
        "input": {"input_file": "uploads/products.csv", "compressed_images_file": None},
        "execution_arn": "arn:aws:states:us-east-1:000000000000:execution:machine:run",
        **extra,
    }


def table_with(item=None, items=None, put_error=None, start_error=None):
    table = MagicMock()
    table.name = "sessions"
    table.get_item.return_value = {"Item": item} if item else {}
    if put_error:
        table.put_item.side_effect = botocore.exceptions.ClientError(
            {"Error": {"Code": put_error, "Message": "failed"}}, "PutItem"
        )
    paginator = MagicMock()
    paginator.paginate.return_value = [{"Items": items or []}]
    table.meta.client.get_paginator.return_value = paginator
    return table


def setup_create(mp, *, env=True, put_error=None, start_error=False):
    table = table_with(put_error=put_error)
    sfn = MagicMock()
    if start_error:
        sfn.start_execution.side_effect = Exception("throttled")
    else:
        sfn.start_execution.return_value = {"executionArn": "arn:aws:states:::execution:machine:run"}
    resource = MagicMock()
    resource.Table.return_value = table
    mp.setattr(create_batch_execution, "get_sfn_client", lambda: sfn)
    mp.setattr(create_batch_execution, "get_dynamodb_resource", lambda: resource)
    mp.setattr(create_batch_execution.uuid, "uuid4", lambda: uuid.UUID(SESSION_ID))
    for name in ("INPUT_BUCKET_NAME", "CATEGORIZATION_MACHINE", "SESSION_TABLE"):
        mp.setattr(create_batch_execution, name, "value" if env else None)
    return {"table": table, "sfn": sfn}


def setup_table(module, mp, *, env=True, **table_args):
    resource = MagicMock()
    resource.Table.return_value = table_with(**table_args)
    mp.setattr(module, "get_dynamodb_resource", lambda: resource)
    if hasattr(module, "get_sfn_client"):
        mp.setattr(module, "get_sfn_client", lambda: MagicMock())
    for name in ("SESSION_TABLE", "CREATED_AT_INDEX_NAME"):
        if hasattr(module, name):
            mp.setattr(module, name, "value" if env else None)


def setup_s3(module, bucket_var, mp, *, env=True, fail=False):
    s3 = fake_s3(fail)
    mp.setattr(module, "get_s3_client", lambda: s3)
    mp.setattr(module, bucket_var, "bucket" if env else None)
    return {"s3": s3}


CREATE_PATH = "/createBatchExecution"
GET_PATH = f"/getBatchExecution/{SESSION_ID}"
CASES = {
    "create: success": (
        create_batch_execution,
        lambda mp: setup_create(mp),
        api_event(CREATE_PATH, body={"inputFile": "uploads/p.csv", "compressedImagesFile": "uploads/i.zip"}),
    ),
    "create: environment not set": (
        create_batch_execution,
        lambda mp: setup_create(mp, env=False),
        api_event(CREATE_PATH, body={"inputFile": "uploads/p.csv"}),
    ),
    "create: empty input file": (
        create_batch_execution,
        lambda mp: setup_create(mp),
        api_event(CREATE_PATH, body={"inputFile": ""}),
    ),
    "create: session exists": (
        create_batch_execution,
        lambda mp: setup_create(mp, put_error="ConditionalCheckFailedException"),
        api_event(CREATE_PATH, body={"inputFile": "uploads/p.csv"}),
    ),
    "create: put_item fails": (
        create_batch_execution,
        lambda mp: setup_create(mp, put_error="ProvisionedThroughputExceededException"),
        api_event(CREATE_PATH, body={"inputFile": "uploads/p.csv"}),
    ),
    "create: start execution fails": (
        create_batch_execution,
        lambda mp: setup_create(mp, start_error=True),
        api_event(CREATE_PATH, body={"inputFile": "uploads/p.csv"}),
    ),
    "get: success": (
        get_batch_execution,
        lambda mp: setup_table(get_batch_execution, mp, item=batch_item(outputKey="out/result.csv")),
        api_event(GET_PATH, "GET", path_parameters={"executionId": SESSION_ID}),
    ),
    "get: running": (
        get_batch_execution,
        lambda mp: setup_table(get_batch_execution, mp, item=batch_item("RUNNING")),
        api_event(GET_PATH, "GET", path_parameters={"executionId": SESSION_ID}),
    ),
    "get: error status": (
        get_batch_execution,
        lambda mp: setup_table(get_batch_execution, mp, item=batch_item("ERROR", error="Failed to queue")),
        api_event(GET_PATH, "GET", path_parameters={"executionId": SESSION_ID}),
    ),
    "get: not found": (
        get_batch_execution,
        lambda mp: setup_table(get_batch_execution, mp),
        api_event(GET_PATH, "GET", path_parameters={"executionId": SESSION_ID}),
    ),
    "get: environment not set": (
        get_batch_execution,
        lambda mp: setup_table(get_batch_execution, mp, env=False),
        api_event(GET_PATH, "GET", path_parameters={"executionId": SESSION_ID}),
    ),
    "list: success": (
        list_batch_executions,
        lambda mp: setup_table(
            list_batch_executions,
            mp,
            items=[batch_item(outputKey="out/a.csv"), batch_item("QUEUED", session_id="other-session")],
        ),
        api_event("/listBatchExecutions", "GET", query={"start_time": "2026-11-01", "end_time": "2026-11-02"}),
    ),
    "list: empty": (
        list_batch_executions,
        lambda mp: setup_table(list_batch_executions, mp),
        api_event("/listBatchExecutions", "GET", query={"start_time": "2026-11-01", "end_time": "2026-11-02"}),
    ),
    "list: range too long": (
        list_batch_executions,
        lambda mp: setup_table(list_batch_executions, mp),
        api_event("/listBatchExecutions", "GET", query={"start_time": "2020-01-01", "end_time": "2026-11-02"}),
    ),
    "list: environment not set": (
        list_batch_executions,
        lambda mp: setup_table(list_batch_executions, mp, env=False),
        api_event("/listBatchExecutions", "GET"),
    ),
    "download: success": (
        download_file,
        lambda mp: setup_s3(download_file, "OUTPUT_BUCKET_NAME", mp),
        api_event("/downloadFile", body={"outputKey": "out/result.csv", "expiration": 60}),
    ),
    "download: empty key": (
        download_file,
        lambda mp: setup_s3(download_file, "OUTPUT_BUCKET_NAME", mp),
        api_event("/downloadFile", body={"outputKey": ""}),
    ),
    "download: environment not set": (
        download_file,
        lambda mp: setup_s3(download_file, "OUTPUT_BUCKET_NAME", mp, env=False),
        api_event("/downloadFile", body={"outputKey": "out/result.csv"}),
    ),
    "download: presign fails": (
        download_file,
        lambda mp: setup_s3(download_file, "OUTPUT_BUCKET_NAME", mp, fail=True),
        api_event("/downloadFile", body={"outputKey": "out/result.csv"}),
    ),
    "upload: image": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp),
        api_event("/uploadFile", body={"fileName": "photo.JPG"}),
    ),
    "upload: csv": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp),
        api_event("/uploadFile", body={"fileName": "products.csv", "expiration": 120}),
    ),
    "upload: zip": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp),
        api_event("/uploadFile", body={"fileName": "images.zip"}),
    ),
    "upload: unsupported type": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp),
        api_event("/uploadFile", body={"fileName": "notes.txt"}),
    ),
    "upload: empty name": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp),
        api_event("/uploadFile", body={"fileName": ""}),
    ),
    "upload: environment not set": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp, env=False),
        api_event("/uploadFile", body={"fileName": "photo.jpg"}),
    ),
    "upload: presign fails": (
        upload_file,
        lambda mp: setup_s3(upload_file, "INPUT_BUCKET_NAME", mp, fail=True),
        api_event("/uploadFile", body={"fileName": "photo.jpg"}),
    ),
}


def invoke(name, monkeypatch):
    module, setup, event = CASES[name]
    mocks = setup(monkeypatch) or {}
    try:
        result = module.handler(event, lambda_context())
    except Exception as e:  # the previous runtime crashed on some paths
        return {"raises": type(e).__name__}
    return {
        **side_effects(mocks),
        "statusCode": result["statusCode"],
        "headers": {k.lower(): v for k, v in (result.get("headers") or {}).items()},
        "multiValueHeaders": result.get("multiValueHeaders") or {},
        "body": json.loads(result["body"]) if result.get("body") else result.get("body"),
    }


def side_effects(mocks):
    """What the batch workflow receives: the session item and the execution input, without timestamps."""
    effects = {}
    if "s3" in mocks and mocks["s3"].generate_presigned_url.call_args:
        effects["presign"] = mocks["s3"].generate_presigned_url.call_args.kwargs
    if "table" not in mocks:
        return effects
    if mocks["table"].put_item.call_args:
        item = dict(mocks["table"].put_item.call_args.kwargs["Item"])
        for key in ("created_at", "updated_at", "date"):
            item.pop(key)
        effects["sessionItem"] = item
    if mocks["sfn"].start_execution.call_args:
        effects["executionInput"] = json.loads(mocks["sfn"].start_execution.call_args.kwargs["input"])
    return effects


@pytest.mark.skipif(not os.getenv("RECORD_GOLDEN"), reason="records the baseline from the previous runtime")
def test_record(monkeypatch):
    recorded = {}
    for name in CASES:
        with monkeypatch.context() as mp:
            recorded[name] = invoke(name, mp)
    GOLDEN_PATH.parent.mkdir(exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(recorded, indent=2, sort_keys=True) + "\n")


def expected(name, golden):
    if name in REPLACED_CRASHES:
        assert golden[name] == {"raises": "AttributeError"}
        replacement = REPLACED_CRASHES[name]
        return {
            **{k: v for k, v in replacement.items() if k not in ("statusCode", "body")},
            "statusCode": replacement["statusCode"],
            "headers": {
                "access-control-allow-headers": "*",
                "access-control-allow-origin": "*",
                "x-amzn-errortype": "InternalFailureError",
            },
            "multiValueHeaders": {},
            "body": replacement["body"],
        }
    if name in REPLACED_EMPTY_BODIES:
        assert golden[name]["body"] == ""
        return {**golden[name], "body": REPLACED_EMPTY_BODIES[name]}
    return golden[name]


@pytest.mark.skipif(bool(os.getenv("RECORD_GOLDEN")), reason="recording")
@pytest.mark.parametrize("name", list(CASES))
def test_response_matches_previous_runtime(name, monkeypatch):
    golden = json.loads(GOLDEN_PATH.read_text())
    assert invoke(name, monkeypatch) == expected(name, golden)
