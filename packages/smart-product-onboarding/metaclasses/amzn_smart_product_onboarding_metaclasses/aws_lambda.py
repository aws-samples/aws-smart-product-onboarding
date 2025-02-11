# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import os

from aws_lambda_powertools.utilities.parser import event_parser

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.dynamodb_client import (
    LAMBDA_DDB_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import (
    LAMBDA_S3_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client import (
    LAMBDA_SSM_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    ProductReadyForMetaclass,
)
from amzn_smart_product_onboarding_metaclasses.VectorRepository.dynamodb import (
    DynamoDBVectorRepository,
)
from amzn_smart_product_onboarding_metaclasses.category_vector_index import (
    CategoryVectorIndex,
)
from amzn_smart_product_onboarding_metaclasses.metaclass_classifier import (
    MetaclassClassifier,
)
from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner

logger.name = "metaclass_handler"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_PATHS_PARAM = os.getenv("CONFIG_PATHS_PARAM")
ssm = LAMBDA_SSM_CLIENT
s3 = LAMBDA_S3_CLIENT
dynamodb = LAMBDA_DDB_CLIENT
bedrock = LAMBDA_BEDROCK_RUNTIME_CLIENT

# download and load config files
config_paths: dict[str, str] = json.loads(
    ssm.get_parameter(Name=CONFIG_PATHS_PARAM)["Parameter"]["Value"]
)

word_map: dict[str, list[str]] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["wordMap"])["Body"].read()
)

category_vectors: dict[str, list[float]] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["categoryVectors"])[
        "Body"
    ].read()
)
category_vector_index = CategoryVectorIndex(category_vectors, 300)

language: str = config_paths["language"]
word_embeddings_table_name = config_paths["wordEmbeddingsTable"]

word_embeddings_repo = DynamoDBVectorRepository(
    dynamodb_client=dynamodb, table_name=word_embeddings_table_name
)

# optional
try:
    brands: list[str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["brands"])[
            "Body"
        ].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No brands file found")
    brands = []
try:
    singularize: dict[str, str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["singularize"])[
            "Body"
        ].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No singularize file found")
    singularize = {}
try:
    synonyms: dict[str, str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["synonyms"])[
            "Body"
        ].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No synonyms file found")
    synonyms = {}
try:
    descriptors: list[str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["descriptors"])[
            "Body"
        ].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No descriptors file found")
    descriptors = []

text_cleaner = TextCleaner(
    singularize=singularize,
    brands=brands,
    synonyms=synonyms,
    descriptors=descriptors,
    language=language,
)

metaclass_classifier = MetaclassClassifier(
    category_vector_index=category_vector_index,
    word_embeddings_repo=word_embeddings_repo,
    language=language,
    word_map=word_map,
    text_cleaner=text_cleaner,
    bedrock=bedrock,
)


@event_parser(model=ProductReadyForMetaclass)
def handler(event: ProductReadyForMetaclass, _):
    logger.debug(f"Event received {event.model_dump_json()}")
    demo = event.demo
    prediction = metaclass_classifier.classify(event.product)
    if not demo:
        prediction.clean_title = None
        prediction.findings = None
    logger.debug(f"Prediction {prediction.model_dump_json()}")
    return prediction.model_dump()
