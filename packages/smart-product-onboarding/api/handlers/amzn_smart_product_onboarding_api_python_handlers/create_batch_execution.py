# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os
import uuid
from datetime import UTC, datetime

import botocore.exceptions
from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler, logger
from amzn_smart_product_onboarding_api_common.models import (
    CreateBatchExecutionRequestContent,
    StartBatchExecutionResponseContent,
)

from .utils import get_dynamodb_resource, get_sfn_client, request_log_fields

INPUT_BUCKET_NAME = os.getenv("INPUT_BUCKET_NAME")
CATEGORIZATION_MACHINE = os.getenv("CATEGORIZATION_MACHINE")
SESSION_TABLE = os.getenv("SESSION_TABLE")


def create_batch_execution(input: ApiRequest[CreateBatchExecutionRequestContent]) -> ApiResponse:
    """
    Handler for the CreateBatchExecution operation
    """
    logger.info("Start CreateBatchExecution operation", extra=request_log_fields(input))
    logger.debug(f"Request body: {input.body}")

    if not CATEGORIZATION_MACHINE:
        logger.exception("CATEGORIZATION_MACHINE is not set")
        return Response.internal_failure("Internal Failure")

    if not INPUT_BUCKET_NAME:
        logger.exception("INPUT_BUCKET_NAME is not set")
        return Response.internal_failure("Internal Failure")

    if not SESSION_TABLE:
        logger.exception("SESSION_TABLE is not set")
        return Response.internal_failure("Internal Failure")

    # validate that input body has input_file. compressed images is optional for now
    if not input.body.input_file:
        return Response.bad_request("Missing title or description")

    sfn = get_sfn_client()
    dynamodb = get_dynamodb_resource()
    table = dynamodb.Table(SESSION_TABLE)

    session_id = str(uuid.uuid4())
    current_time = datetime.now(UTC).isoformat()
    current_date = current_time[0:10]

    try:
        table.put_item(
            Item={
                "session_id": session_id,
                "status": "QUEUED",
                "date": current_date,
                "created_at": current_time,
                "updated_at": current_time,
                "input": input.body.model_dump(),
                "type": "Session",
            },
            ConditionExpression="attribute_not_exists(session_id)",
        )
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.info("Session already exists")
            return Response.bad_request("Session already exists")
        else:
            raise

    payload = {
        "session_id": session_id,
        "detail": {
            "bucket": {
                "name": INPUT_BUCKET_NAME,
            },
            "object": {
                "key": input.body.input_file,
            },
        },
    }

    if input.body.compressed_images_file:
        payload["images_key"] = input.body.compressed_images_file

    logger.debug(f"Payload: {payload}")

    try:
        response = sfn.start_execution(stateMachineArn=CATEGORIZATION_MACHINE, input=json.dumps(payload))
    except Exception as e:
        logger.exception(f"Error starting execution: {e}")
        current_time = datetime.now().isoformat()
        current_date = current_time[0:10]
        table.update_item(
            Key={"session_id": session_id},
            UpdateExpression="set #st = :st, #ua = :ua, #d = :d, #er = :er",
            ExpressionAttributeNames={
                "#st": "status",
                "#ua": "updated_at",
                "#d": "date",
                "#er": "error",
            },
            ExpressionAttributeValues={
                ":st": "ERROR",
                ":ua": current_time,
                ":d": current_date,
                ":er": "Failed to queue the execution",
            },
        )
        return Response.internal_failure("Error starting execution")

    current_time = datetime.now().isoformat()
    current_date = current_time[0:10]
    try:
        table.update_item(
            Key={"session_id": session_id},
            UpdateExpression="set #ua = :ua, #ea = :ea, #d = :d",
            ExpressionAttributeNames={
                "#ua": "updated_at",
                "#ea": "execution_arn",
                "#d": "date",
            },
            ExpressionAttributeValues={
                ":ua": current_time,
                ":ea": response["executionArn"],
                ":d": current_date,
            },
        )
    except Exception as e:
        logger.exception(e)
        logger.error(f"Failed to update the session with running execution with session_id {session_id}")
        pass

    logger.info(f"Started execution: {response['executionArn']}")
    return Response.success(
        StartBatchExecutionResponseContent(
            execution_id=session_id,
            status="QUEUED",
        )
    )


# Entry point for the AWS Lambda handler for the CreateBatchExecution operation.
handler = api_handler("create_batch_execution", CreateBatchExecutionRequestContent)(create_batch_execution)
