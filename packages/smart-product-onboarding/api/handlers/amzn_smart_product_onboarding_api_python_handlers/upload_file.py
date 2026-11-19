# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
from pathlib import Path
from uuid import NAMESPACE_X500, uuid4, uuid5

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler, logger
from amzn_smart_product_onboarding_api_common.models import (
    PresignedUrlResponse,
    UploadFileRequestContent,
)

from .utils import create_presigned_url, get_s3_client, request_log_fields

INPUT_BUCKET_NAME = os.getenv("INPUT_BUCKET_NAME")


def create_object_key(input, file_name: str, logger):
    username = (
        input.event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("cognito:username", None)
    )
    logger.debug("using username-based prefix")

    # we need a unique part since file_names can repeat
    if username:
        # abusing the X500 namespace for a consistent username-based hash in UUID form
        return f"uploads/{str(uuid5(NAMESPACE_X500, username))}-{file_name}"
    else:
        logger.warning("no username found. falling back to a random uuid")
        return f"uploads/{str(uuid4())}-{file_name}"


def upload_file(input: ApiRequest[UploadFileRequestContent]) -> ApiResponse:
    """
    Handler for the UploadFile operation
    """
    logger.info("Start UploadFile operation", extra={**request_log_fields(input), "file_name": input.body.file_name})

    if not INPUT_BUCKET_NAME:
        logger.exception("INPUT_BUCKET_NAME is not set")
        return Response.internal_failure("Internal Failure")

    file_name = input.body.file_name

    # validate input
    if not file_name:
        logger.exception("fileName parameter is not set")
        return Response.internal_failure("Invalid request format")

    object_key = create_object_key(input, file_name, logger)

    file_extension = Path(file_name).suffix.lstrip(".")

    # we currently know how to handle zip, csv or some image types
    if file_extension.lower() in ["jpeg", "jpg", "png", "webp", "gif"]:
        if file_extension.lower() == "jpg":
            file_extension = "jpeg"
        content_type = "image/" + file_extension
    elif file_extension.lower() == "zip":
        content_type = "application/zip"
    elif file_extension.lower() == "csv":
        content_type = "text/csv"
    else:
        logger.exception("Unsupported file type")
        return Response.internal_failure("Invalid request format")

    s3_client = get_s3_client()

    try:
        presigned_upload_link = create_presigned_url(
            s3_client,
            logger,
            INPUT_BUCKET_NAME,
            object_key=object_key,
            expiration=input.body.expiration,
            client_method="put_object",
            content_type=content_type,
        )

        return Response.success(PresignedUrlResponse(url=presigned_upload_link, object_key=object_key))
    except Exception as e:
        logger.exception(f"Error generating presigned url: {e}")
        return Response.internal_failure("Error generating presigned URL")


# Entry point for the AWS Lambda handler for the UploadFile operation.
handler = api_handler("upload_file", UploadFileRequestContent)(upload_file)
