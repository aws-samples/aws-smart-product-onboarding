# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler, logger

from .repository import DynamoDBSessionRepository, ResourceNotFound
from .utils import get_dynamodb_resource, get_sfn_client, request_log_fields

SESSION_TABLE = os.getenv("SESSION_TABLE")


def get_batch_execution(input: ApiRequest[None]) -> ApiResponse:
    """
    Handler for the GetBatchExecution operation
    """
    logger.info("Start GetBatchExecution operation", extra=request_log_fields(input))
    logger.debug(f"Request parameters: {input.path_parameters}")

    execution_id = input.path_parameters.get("executionId")

    # validate that input path params include execution_id
    if not execution_id:
        return Response.bad_request("Missing executionId path parameter")

    if not SESSION_TABLE:
        logger.exception("SESSION_TABLE is not set")
        return Response.internal_failure("Internal Failure")

    sfn = get_sfn_client()
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(SESSION_TABLE)
    repository = DynamoDBSessionRepository(table, sfn=sfn)

    try:
        execution = repository.get(execution_id=execution_id)
    except ResourceNotFound:
        logger.exception(f"Execution with id {execution_id} not found")
        return Response.not_found("Execution not found")

    return Response.success(execution)


# Entry point for the AWS Lambda handler for the GetBatchExecution operation.
handler = api_handler("get_batch_execution")(get_batch_execution)
