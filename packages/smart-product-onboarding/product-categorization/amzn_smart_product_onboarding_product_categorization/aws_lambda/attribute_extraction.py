# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigClient
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_RESOURCE,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    Attribute,
    ExtractAttributesRequest,
    ExtractAttributesResponse,
    ExtractAttributesResponseDict,
)
from aws_lambda_powertools.utilities.parser import event_parser

from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    AttributesExtractor,
    GPCSchemaRetriever,
)

logger.name = "AttributeExtraction"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_BUCKET = LAMBDA_S3_RESOURCE.Bucket(CONFIG_BUCKET_NAME)
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-premier-v1:0")

# AppConfig client for runtime configuration
appconfig_client = AppConfigClient(
    application_id=os.getenv("APPCONFIG_APPLICATION_ID", ""),
    environment_id=os.getenv("APPCONFIG_ENVIRONMENT_ID", ""),
    configuration_profile_id=os.getenv("APPCONFIG_CONFIGURATION_PROFILE_ID", ""),
)


@event_parser(model=ExtractAttributesRequest)
def handler(event: ExtractAttributesRequest, _) -> ExtractAttributesResponseDict:
    logger.debug(f"Event received: {event.model_dump_json()}")

    # Fetch runtime configuration from AppConfig
    config = appconfig_client.get_configuration("attributeExtraction")
    if config:
        model_id = config.model_id
        temperature = config.temperature
    else:
        model_id = BEDROCK_MODEL_ID
        temperature = 0

    schema_retriever = GPCSchemaRetriever(schema_storage=CONFIG_BUCKET, schema_path="data/attributes_schema.json")
    attributes_extractor = AttributesExtractor(
        bedrock_runtime_client=LAMBDA_BEDROCK_RUNTIME_CLIENT,
        schema_retriever=schema_retriever,
        model_id=model_id,
        temperature=temperature,
    )

    extracted_attributes = attributes_extractor.extract_attributes(event.product, event.category.predicted_category_id)

    response = ExtractAttributesResponse(
        attributes=[Attribute(name=attr.name, value=attr.value) for attr in extracted_attributes.attributes]
    )

    logger.debug(f"Extracted attributes: {response.model_dump_json()}")

    return response.model_dump()
