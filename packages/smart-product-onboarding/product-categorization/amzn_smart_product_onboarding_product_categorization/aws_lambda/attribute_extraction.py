# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from aws_lambda_powertools.utilities.parser import event_parser

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_RESOURCE,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    ExtractAttributesRequest,
    ExtractAttributesResponse,
    ExtractAttributesResponseDict,
    Attribute,
)
from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    GPCSchemaRetriever,
    AttributesExtractor,
)

logger.name = "AttributeExtraction"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_BUCKET = LAMBDA_S3_RESOURCE.Bucket(CONFIG_BUCKET_NAME)
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-premier-v1:0")


@event_parser(model=ExtractAttributesRequest)
def handler(event: ExtractAttributesRequest, _) -> ExtractAttributesResponseDict:
    logger.debug(f"Event received: {event.model_dump_json()}")

    schema_retriever = GPCSchemaRetriever(
        schema_storage=CONFIG_BUCKET, schema_path="data/attributes_schema.json"
    )
    attributes_extractor = AttributesExtractor(
        bedrock_runtime_client=LAMBDA_BEDROCK_RUNTIME_CLIENT,
        schema_retriever=schema_retriever,
        model_id=MODEL_ID,
    )

    extracted_attributes = attributes_extractor.extract_attributes(
        event.product, event.category.predicted_category_id
    )

    response = ExtractAttributesResponse(
        attributes=[
            Attribute(name=attr.name, value=attr.value)
            for attr in extracted_attributes.attributes
        ]
    )

    logger.debug(f"Extracted attributes: {response.model_dump_json()}")

    return response.model_dump()
