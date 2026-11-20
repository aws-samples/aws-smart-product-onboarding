# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler
from botocore.exceptions import ClientError
from amzn_smart_product_onboarding_api_common.models import (
    ExtractAttributesRequestContent,
    ExtractAttributesResponseContent,
    ProductAttribute,
)

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,    ensure_cross_region_profile,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_RESOURCE,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client import (
    LAMBDA_SSM_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.exceptions import (
    ContentFilteredError,
    RateLimitError,
    RetryableError,
    ModelResponseError,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import Product
from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    GPCSchemaRetriever,
    AttributesExtractor,
)

logger.name = "AttributeExtraction"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_BUCKET = LAMBDA_S3_RESOURCE.Bucket(CONFIG_BUCKET_NAME)
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-sonnet-5-5")
CONFIG_PATHS_PARAM = os.getenv("CONFIG_PATHS_PARAM")

# Read the schema from the same configuration as the category tree. Configurations written
# by the notebooks have no attributesSchema entry and keep the schema at the fixed key, and
# notebook 1 uploads that key before notebook 2 creates the parameter.
try:
    config_paths: dict[str, str] = json.loads(
        LAMBDA_SSM_CLIENT.get_parameter(Name=CONFIG_PATHS_PARAM)["Parameter"]["Value"]
    )
except ClientError as e:
    if e.response["Error"]["Code"] != "ParameterNotFound":
        raise
    config_paths = {}
SCHEMA_PATH = config_paths.get("attributesSchema", "data/attributes_schema.json")

if os.getenv("BEDROCK_XACCT_ROLE"):
    # when using cross-acct roles we would like to use CRIS (Cross-Region Inference)
    MODEL_ID = ensure_cross_region_profile(MODEL_ID)


def extract_attributes(event: ApiRequest[ExtractAttributesRequestContent]) -> ApiResponse:
    logger.debug(f"Request body: {event.body}")

    try:
        schema_retriever = GPCSchemaRetriever(
            schema_storage=CONFIG_BUCKET, schema_path=SCHEMA_PATH
        )
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while retrieving schema: {e}")
        return Response.internal_failure("Internal server error")
    attributes_extractor = AttributesExtractor(
        bedrock_runtime_client=LAMBDA_BEDROCK_RUNTIME_CLIENT,
        schema_retriever=schema_retriever,
        model_id=MODEL_ID,
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
    except ContentFilteredError as e:
        logger.warning(f"Content filter stopped the model: {e}")
        return Response.bad_request(str(e))
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
            attributes=[
                ProductAttribute(name=attr.name, value=attr.value)
                for attr in extracted_attributes.attributes
            ]
        )
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while creating response: {e}")
        return Response.internal_failure("Internal server error")

    logger.debug(f"Extracted attributes: {response.model_dump_json()}")

    return Response.success(response)


handler = api_handler("extract_attributes", ExtractAttributesRequestContent)(extract_attributes)
