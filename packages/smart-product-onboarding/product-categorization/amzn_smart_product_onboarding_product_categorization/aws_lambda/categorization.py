# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json

import os

from aws_lambda_powertools.utilities.parser import event_parser

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import LAMBDA_BEDROCK_RUNTIME_CLIENT
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import LAMBDA_S3_CLIENT
from amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client import LAMBDA_SSM_CLIENT
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.types import ProductReadyForCategorization, ProductCategory
from amzn_smart_product_onboarding_product_categorization.product_classifier import ProductClassifier

logger.name = "categorization_handler"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_PATHS_PARAM = os.getenv("CONFIG_PATHS_PARAM")
DEMO = os.getenv("DEMO", False) == "True"
MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")

if os.getenv("BEDROCK_XACCT_ROLE") and MODEL_ID[:3] != "us.":
    # when using cross-acct roles we would like to use CRIS (Cross-Region Inference)
    MODEL_ID = "us." + MODEL_ID

ssm = LAMBDA_SSM_CLIENT
s3 = LAMBDA_S3_CLIENT
bedrock = LAMBDA_BEDROCK_RUNTIME_CLIENT

# download and load config files
config_paths: dict[str, str] = json.loads(ssm.get_parameter(Name=CONFIG_PATHS_PARAM)["Parameter"]["Value"])
category_tree: dict[str, ProductCategory] = {
    k: ProductCategory.model_validate(v)
    for k, v in json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["categoryTree"])["Body"].read()
    ).items()
}
always_categories: list[str] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["alwaysCategories"])["Body"].read()
)

product_classifier = ProductClassifier(
    bedrock=LAMBDA_BEDROCK_RUNTIME_CLIENT,
    category_tree=category_tree,
    always_categories=always_categories,
    include_prompt=DEMO,
    model_id=MODEL_ID,
)


@event_parser(model=ProductReadyForCategorization)
def handler(event: ProductReadyForCategorization, _):
    logger.debug(f"Event received {event.model_dump_json()}")
    prediction = product_classifier.classify(
        event.product, event.metaclass.possible_categories, include_prompt=event.demo, dryrun=event.dryrun
    )
    logger.debug(f"Prediction: {prediction.model_dump_json()}")
    return prediction.model_dump()
