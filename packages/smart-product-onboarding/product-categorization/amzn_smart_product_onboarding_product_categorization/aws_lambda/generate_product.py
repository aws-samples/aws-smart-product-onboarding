# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The batch workflow's generate-product step: a title and description for a product row that has images."""

import os

from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigClient
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import LAMBDA_S3_CLIENT
from amzn_smart_product_onboarding_core_utils.logger import logger
from aws_lambda_powertools.utilities.parser import event_parser
from pydantic import BaseModel

from amzn_smart_product_onboarding_product_categorization.product_generator import ProductGenerator

logger.name = "generate_product_sfn_handler"

DEFAULT_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-5-5")
DEFAULT_TEMPERATURE = 0.1
DEFAULT_DESCRIPTION_LENGTH = "medium"

appconfig_client = AppConfigClient(
    application_id=os.getenv("APPCONFIG_APPLICATION_ID", ""),
    environment_id=os.getenv("APPCONFIG_ENVIRONMENT_ID", ""),
    configuration_profile_id=os.getenv("APPCONFIG_CONFIGURATION_PROFILE_ID", ""),
)


class GenerateProductEvent(BaseModel):
    images: list[str]
    metadata: str | None = None
    prefix: str | None = None


@event_parser(model=GenerateProductEvent)
def handler(event: GenerateProductEvent, _) -> dict:
    """Return the generated title and description, which replace the product in the workflow state.

    Errors are raised for the state machine to retry or catch by name, such as RateLimitError, RetryableError,
    ModelResponseError and ContentFilteredError.
    """
    bucket = os.getenv("IMAGE_BUCKET")
    if not bucket:
        logger.error("IMAGE_BUCKET environment variable not set!")
        raise RuntimeError("IMAGE_BUCKET environment variable not set!")

    config = appconfig_client.get_configuration("productGeneration")
    product = ProductGenerator(LAMBDA_BEDROCK_RUNTIME_CLIENT, LAMBDA_S3_CLIENT, bucket).generate(
        image_keys=[f"{event.prefix}/{image}" if event.prefix else image for image in event.images],
        model_id=config.model_id if config else DEFAULT_MODEL_ID,
        temperature=config.temperature if config else DEFAULT_TEMPERATURE,
        language=config.language if config else None,
        description_length=(config.description_length if config else None) or DEFAULT_DESCRIPTION_LENGTH,
        metadata=event.metadata,
        examples=config.examples if config else None,
    )
    # The title and description can repeat seller-supplied metadata, so only the usage is logged.
    logger.info({"usage": product.usage})
    return {"title": product.title, "description": product.description}
