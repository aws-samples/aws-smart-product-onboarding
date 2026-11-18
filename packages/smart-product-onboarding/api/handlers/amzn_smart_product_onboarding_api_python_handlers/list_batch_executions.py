# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
from datetime import UTC, datetime, timedelta

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler, logger
from amzn_smart_product_onboarding_api_common.models import BatchExecution, ListBatchExecutionsResponseContent

from .repository import DynamoDBSessionRepository
from .utils import get_dynamodb_resource, request_log_fields

SESSION_TABLE = os.getenv("SESSION_TABLE")
CREATED_AT_INDEX_NAME = os.getenv("CREATED_AT_INDEX_NAME")

MAX_DAYS = int(os.getenv("MAX_DAYS", "1000"))


class InvalidDateRange(Exception): ...


def _parse_date_range_from(start_time: str | None = None, end_time: str | None = None) -> tuple[str, str]:
    start_date = datetime.fromisoformat(start_time) if start_time else None
    end_date = datetime.fromisoformat(end_time) if end_time else None
    if start_time is not None and len(start_time) == 10:
        start_time = start_time + "T00:00:00Z"
    if end_time is not None and len(end_time) == 10:
        end_time = end_time + "T23:59:59Z"

    # check if start time and end time are within MAX_DAYS of each other
    if start_time and end_time:
        if (end_date - start_date).days > MAX_DAYS:
            raise InvalidDateRange()
    # if only end time is provided
    elif end_time:
        start_time = (end_date - timedelta(days=MAX_DAYS)).isoformat()
    # if only start time is provided
    elif start_time:
        end_time = (start_date + timedelta(days=MAX_DAYS)).isoformat()
    # if neither start time nor end time are provided
    else:
        today = datetime.now(UTC)
        start_time = (today - timedelta(days=MAX_DAYS)).isoformat()
        end_time = today.isoformat()

    return start_time, end_time


def list_batch_executions(input: ApiRequest[None]) -> ApiResponse:
    """
    Handler for the ListBatchExecutions operation
    """
    logger.info("Start ListBatchExecutions operation", extra=request_log_fields(input))
    logger.debug(f"Request parameters: {input.query_parameters}")

    if not SESSION_TABLE:
        logger.exception("SESSION_TABLE is not set")
        return Response.internal_failure("Internal Failure")

    if not CREATED_AT_INDEX_NAME:
        logger.exception("CREATED_AT_INDEX_NAME is not set")
        return Response.internal_failure("Internal Failure")

    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(SESSION_TABLE)
    repository = DynamoDBSessionRepository(table, created_at_index_name=CREATED_AT_INDEX_NAME)

    # Times as ISO 8601 strings
    start_time = input.query_parameters.get("start_time")
    end_time = input.query_parameters.get("end_time")

    try:
        date_range = _parse_date_range_from(start_time, end_time)
    except InvalidDateRange:
        return Response.bad_request(f"Start time and end time cannot be more than {MAX_DAYS} days apart")

    executions: list[BatchExecution] = repository.list(date_range=date_range)
    logger.info(f"Executions: {[execution.model_dump_json() for execution in executions]}")

    return Response.success(ListBatchExecutionsResponseContent(executions=executions))


# Entry point for the AWS Lambda handler for the ListBatchExecutions operation.
handler = api_handler("list_batch_executions")(list_batch_executions)
