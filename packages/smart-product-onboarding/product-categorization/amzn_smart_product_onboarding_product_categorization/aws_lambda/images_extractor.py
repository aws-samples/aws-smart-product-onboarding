# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from aws_lambda_powertools.utilities.parser import event_parser

from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    ExtractImagesRequest,
    ExtractImagesResponseDict,
    ExtractImagesResponse,
)
from amzn_smart_product_onboarding_product_categorization.images_extractor import (
    ImagesExtractor,
)

logger.name = "ImagesExtractor"

IMAGES_BUCKET_NAME = os.getenv("IMAGES_BUCKET_NAME")
if not IMAGES_BUCKET_NAME:
    raise ValueError("IMAGES_BUCKET_NAME environment variable not set")


@event_parser(model=ExtractImagesRequest)
def handler(event: ExtractImagesRequest, _) -> ExtractImagesResponseDict:
    logger.debug(f"Event received: {event.model_dump_json()}")

    images_zip_key = event.images_key

    images_prefix = event.prefix
    logger.info(f"Extracting images from {images_zip_key} to {images_prefix}")

    extractor = ImagesExtractor(s3=LAMBDA_S3_CLIENT, bucket=IMAGES_BUCKET_NAME)
    extractor.process_zip_file(images_zip_key, images_prefix)

    return ExtractImagesResponse(images_prefix=images_prefix).model_dump()
