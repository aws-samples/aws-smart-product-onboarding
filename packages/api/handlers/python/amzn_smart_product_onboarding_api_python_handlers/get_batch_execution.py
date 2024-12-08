# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
import json

from amzn_smart_product_onboarding_api_python_runtime.models import *
from amzn_smart_product_onboarding_api_python_runtime.response import Response
from amzn_smart_product_onboarding_api_python_runtime.interceptors import INTERCEPTORS
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.logger import LoggingInterceptor
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import (
    get_batch_execution_handler,
    GetBatchExecutionRequest,
    GetBatchExecutionOperationResponses,
)

from .utils import get_dynamodb_resource, get_sfn_client
from .repository import DynamoDBSessionRepository, ResourceNotFound

SESSION_TABLE = os.getenv("SESSION_TABLE")


def get_batch_execution(input: GetBatchExecutionRequest, **kwargs) -> GetBatchExecutionOperationResponses:
    """
    Type-safe handler for the GetBatchExecution operation
    """
    logger = LoggingInterceptor.get_logger(input)
    logger.info("Start CategorizeProductResult Operation")
    logger.debug(f"Input: {input}")

    execution_id = input.request_parameters.execution_id

    # validate that input path params include execution_id
    if not execution_id:
        return Response.bad_request(BadRequestErrorResponseContent(message="Missing executionId path parameter"))

    if not SESSION_TABLE:
        logger.exception("SESSION_TABLE is not set")
        return Response.internal_failure(InternalFailureErrorResponseContent(message="Internal Failure"))

    sfn = get_sfn_client()
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(SESSION_TABLE)
    repository = DynamoDBSessionRepository(table, sfn=sfn)

    try:
        execution = repository.get(execution_id=execution_id)
    except ResourceNotFound:
        logger.exception(f"Execution with id {execution_id} not found")
        return Response.not_found(BadRequestErrorResponseContent(message="Execution not found"))

    return Response.success(execution)


# Entry point for the AWS Lambda handler for the GetBatchExecution operation.
# The get_batch_execution_handler method wraps the type-safe handler and manages marshalling inputs and outputs
handler = get_batch_execution_handler(interceptors=INTERCEPTORS)(get_batch_execution)
