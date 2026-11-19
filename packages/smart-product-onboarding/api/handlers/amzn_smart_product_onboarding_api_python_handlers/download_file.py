# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler, logger
from amzn_smart_product_onboarding_api_common.models import (
    DownloadFileRequestContent,
    PresignedUrlResponse,
)

from .utils import create_presigned_url, get_s3_client, request_log_fields

OUTPUT_BUCKET_NAME = os.getenv("OUTPUT_BUCKET_NAME")


def download_file(input: ApiRequest[DownloadFileRequestContent]) -> ApiResponse:
    """
    Handler for the DownloadFile operation
    """
    logger.info(
        "Start DownloadFile operation", extra={**request_log_fields(input), "output_key": input.body.output_key}
    )

    if not OUTPUT_BUCKET_NAME:
        logger.exception("OUTPUT_BUCKET_NAME is not set")
        return Response.internal_failure("Internal Failure")

    object_key = input.body.output_key

    # validate input
    if not object_key:
        logger.exception("objectKey parameter is not set")
        return Response.internal_failure("Invalid request format")

    s3_client = get_s3_client()

    try:
        presigned_download_link = create_presigned_url(
            s3_client,
            logger,
            OUTPUT_BUCKET_NAME,
            object_key=object_key,
            expiration=input.body.expiration,
            client_method="get_object",
        )

        return Response.success(PresignedUrlResponse(url=presigned_download_link))
    except Exception as e:
        logger.exception(f"Error generating presigned url: {e}")
        return Response.internal_failure("Error generating presigned URL")


# Entry point for the AWS Lambda handler for the DownloadFile operation.
handler = api_handler("download_file", DownloadFileRequestContent)(download_file)
