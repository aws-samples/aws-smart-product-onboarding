# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler
from amzn_smart_product_onboarding_api_common.models import (
    CategorizeProductRequestContent,
    CategorizeProductResponseContent,
)

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,    ensure_cross_region_profile,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_CLIENT,
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
from amzn_smart_product_onboarding_core_utils.models import ProductCategory
from amzn_smart_product_onboarding_product_categorization.product_classifier import (
    ProductClassifier,
)

logger.name = "categorization_handler"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_PATHS_PARAM = os.getenv("CONFIG_PATHS_PARAM")
DEMO = os.getenv("DEMO", False) == "True"
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-5-5")

if os.getenv("BEDROCK_XACCT_ROLE"):
    # when using cross-acct roles we would like to use CRIS (Cross-Region Inference)
    MODEL_ID = ensure_cross_region_profile(MODEL_ID)

ssm = LAMBDA_SSM_CLIENT
s3 = LAMBDA_S3_CLIENT
bedrock = LAMBDA_BEDROCK_RUNTIME_CLIENT

# download and load config files
config_paths: dict[str, str] = json.loads(
    ssm.get_parameter(Name=CONFIG_PATHS_PARAM)["Parameter"]["Value"]
)
category_tree: dict[str, ProductCategory] = {
    k: ProductCategory.model_validate(v)
    for k, v in json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["categoryTree"])[
            "Body"
        ].read()
    ).items()
}
always_categories: list[str] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["alwaysCategories"])[
        "Body"
    ].read()
)

product_classifier = ProductClassifier(
    bedrock=LAMBDA_BEDROCK_RUNTIME_CLIENT,
    category_tree=category_tree,
    always_categories=always_categories,
    include_prompt=DEMO,
    model_id=MODEL_ID,
)


def categorize_product(event: ApiRequest[CategorizeProductRequestContent]) -> ApiResponse:
    logger.debug(f"Request body: {event.body}")
    try:
        prediction = product_classifier.classify(
            event.body.product,
            event.body.possible_categories,
            include_prompt=event.body.demo,
        )
    except ContentFilteredError as e:
        logger.warning(f"Content filter stopped the model: {e}")
        return Response.bad_request(str(e))
    except (RateLimitError, RetryableError, ModelResponseError) as e:
        logger.exception(e)
        logger.error(f"Retryable error while categorizing: {e}")
        return Response.internal_failure("Retryable error")
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while categorizing: {e}")
        return Response.internal_failure("Internal server error")

    logger.debug(f"Prediction: {prediction.model_dump_json()}")
    try:
        return Response.success(
            CategorizeProductResponseContent(
                category_id=prediction.predicted_category_id,
                category_name=prediction.predicted_category_name,
                category_path=category_tree[
                    prediction.predicted_category_id
                ].formatted_path,
                explanation=prediction.explanation,
                prompt=prediction.prompt if event.body.demo else None,
            )
        )
    except Exception as e:
        logger.exception(e)
        logger.error(f"Error while creating response: {e}")
        return Response.internal_failure("Internal server error")


handler = api_handler("categorize_product", CategorizeProductRequestContent)(categorize_product)
