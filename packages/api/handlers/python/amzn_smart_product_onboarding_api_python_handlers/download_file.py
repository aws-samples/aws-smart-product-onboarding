# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_api_python_runtime.models import *
from amzn_smart_product_onboarding_api_python_runtime.response import Response
from amzn_smart_product_onboarding_api_python_runtime.interceptors import INTERCEPTORS
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.logger import LoggingInterceptor
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import (
    download_file_handler,
    DownloadFileRequest,
    DownloadFileOperationResponses,
)

from .utils import get_s3_client, create_presigned_url

OUTPUT_BUCKET_NAME = os.getenv("OUTPUT_BUCKET_NAME")


def download_file(input: DownloadFileRequest, **kwargs) -> DownloadFileOperationResponses:
    """
    Type-safe handler for the DownloadFile operation
    """
    logger = LoggingInterceptor.get_logger(input)
    logger.info("Start CategorizeProductResult Operation")
    logger.info(f"Input: {input}")

    if not OUTPUT_BUCKET_NAME:
        logger.exception("OUTPUT_BUCKET_NAME is not set")
        return Response.internal_failure(InternalFailureErrorResponseContent(message="Internal Failure"))

    object_key = input.body.output_key

    # validate input
    if not object_key:
        logger.exception("objectKey parameter is not set")
        return Response.internal_failure(BadRequestErrorResponseContent(message="Invalid request format"))

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
        return Response.internal_failure(InternalFailureErrorResponseContent(message="Error generating presigned URL"))


# Entry point for the AWS Lambda handler for the DownloadFile operation.
# The download_file_handler method wraps the type-safe handler and manages marshalling inputs and outputs
handler = download_file_handler(interceptors=INTERCEPTORS)(download_file)
