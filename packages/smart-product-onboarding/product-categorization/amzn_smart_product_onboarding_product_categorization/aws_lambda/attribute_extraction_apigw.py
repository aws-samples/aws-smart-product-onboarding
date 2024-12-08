# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_api_python_runtime import (
    ExtractAttributesRequestContent,
    ExtractAttributesResponseContent,
    ProductAttribute,
)
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import (
    extract_attributes_handler,
    ExtractAttributesOperationResponses,
    ExtractAttributesRequest,
)
from amzn_smart_product_onboarding_api_python_runtime.interceptors import INTERCEPTORS
from amzn_smart_product_onboarding_api_python_runtime.response import Response
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import LAMBDA_BEDROCK_RUNTIME_CLIENT
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import LAMBDA_S3_RESOURCE
from amzn_smart_product_onboarding_core_utils.exceptions import RateLimitError, RetryableError, ModelResponseError
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.types import CategorizationPrediction, Product
from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    GPCSchemaRetriever,
    AttributesExtractor,
)

logger.name = "AttributeExtraction"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_BUCKET = LAMBDA_S3_RESOURCE.Bucket(CONFIG_BUCKET_NAME)
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")

if os.getenv("BEDROCK_XACCT_ROLE") and MODEL_ID[:3] != "us.":
    # when using cross-acct roles we would like to use CRIS (Cross-Region Inference)
    MODEL_ID = "us." + MODEL_ID


def extract_attributes(event: ExtractAttributesRequest, **kwargs) -> ExtractAttributesOperationResponses:
    logger.debug(f"Event received: {event}")

    try:
        schema_retriever = GPCSchemaRetriever(schema_storage=CONFIG_BUCKET, schema_path="data/attributes_schema.json")
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while retrieving schema: {e}")
        return Response.internal_failure("Internal server error")
    attributes_extractor = AttributesExtractor(
        bedrock_runtime_client=LAMBDA_BEDROCK_RUNTIME_CLIENT, schema_retriever=schema_retriever, model_id=MODEL_ID
    )

    try:
        extracted_attributes = attributes_extractor.extract_attributes(
            Product(
                title=event.body.product.title,
                description=event.body.product.description,
                metadata=event.body.product.metadata,
            ),
            event.body.category_id,
        )
    except (RateLimitError, RetryableError, ModelResponseError) as e:
        logger.exception(e)
        logger.error(f"Error while extracting attributes: {e}")
        return Response.internal_failure("Retryable error")
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while extracting attributes: {e}")
        return Response.internal_failure("Internal server error")

    try:
        response = ExtractAttributesResponseContent(
            attributes=[ProductAttribute(name=attr.name, value=attr.value) for attr in extracted_attributes.attributes]
        )
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while creating response: {e}")
        return Response.internal_failure("Internal server error")

    logger.debug(f"Extracted attributes: {response.model_dump_json()}")

    return Response.success(response)


handler = extract_attributes_handler(interceptors=INTERCEPTORS)(extract_attributes)
