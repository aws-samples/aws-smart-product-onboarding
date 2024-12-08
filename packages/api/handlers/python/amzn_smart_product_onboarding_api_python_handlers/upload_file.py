# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
from pathlib import Path
from uuid import uuid5, uuid4, NAMESPACE_X500

from amzn_smart_product_onboarding_api_python_runtime.models import *
from amzn_smart_product_onboarding_api_python_runtime.response import Response
from amzn_smart_product_onboarding_api_python_runtime.interceptors import INTERCEPTORS
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.logger import LoggingInterceptor
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import (
    upload_file_handler,
    UploadFileRequest,
    UploadFileOperationResponses,
)

from .utils import get_s3_client, create_presigned_url

INPUT_BUCKET_NAME = os.getenv("INPUT_BUCKET_NAME")


def create_object_key(input, file_name: str, logger):
    username = (
        input.event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("cognito:username", None)
    )
    logger.debug(f"using username for prefix: {username}")

    # we need a unique part since file_names can repeat
    if username:
        # abusing the X500 namespace for a consistent username-based hash in UUID form
        return f"uploads/{str(uuid5(NAMESPACE_X500, username))}-{file_name}"
    else:
        logger.warning("no username found. falling back to a random uuid")
        return f"uploads/{str(uuid4())}-{file_name}"


def upload_file(input: UploadFileRequest, **kwargs) -> UploadFileOperationResponses:
    """
    Type-safe handler for the UploadFile operation
    """
    logger = LoggingInterceptor.get_logger(input)
    logger.info("Start CategorizeProductResult Operation")
    logger.info(f"Input: {input}")

    if not INPUT_BUCKET_NAME:
        logger.exception("INPUT_BUCKET_NAME is not set")
        return Response.internal_failure(InternalFailureErrorResponseContent(message="Internal Failure"))

    file_name = input.body.file_name

    # validate input
    if not file_name:
        logger.exception("fileName parameter is not set")
        return Response.internal_failure(BadRequestErrorResponseContent(message="Invalid request format"))

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
        return Response.internal_failure(BadRequestErrorResponseContent(message="Invalid request format"))

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
        return Response.internal_failure(InternalFailureErrorResponseContent(message="Error generating presigned URL"))


# Entry point for the AWS Lambda handler for the UploadFile operation.
# The upload_file_handler method wraps the type-safe handler and manages marshalling inputs and outputs
handler = upload_file_handler(interceptors=INTERCEPTORS)(upload_file)
