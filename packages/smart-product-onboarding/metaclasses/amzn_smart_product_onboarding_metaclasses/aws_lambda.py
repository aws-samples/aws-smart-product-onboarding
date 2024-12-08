# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from gensim.models import KeyedVectors

import json

import os
from aws_lambda_powertools.utilities.parser import event_parser
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import LAMBDA_S3_CLIENT
from amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client import LAMBDA_SSM_CLIENT
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner
from amzn_smart_product_onboarding_core_utils.types import (
    Product,
    ProductCategory,
    MetaclassPrediction,
    ProductReadyForMetaclass,
)
from amzn_smart_product_onboarding_metaclasses.metaclass_classifier import MetaclassClassifier

logger.name = "metaclass_handler"

CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME")
CONFIG_PATHS_PARAM = os.getenv("CONFIG_PATHS_PARAM")
ssm = LAMBDA_SSM_CLIENT
s3 = LAMBDA_S3_CLIENT

# download and load config files
config_paths: dict[str, str] = json.loads(ssm.get_parameter(Name=CONFIG_PATHS_PARAM)["Parameter"]["Value"])
category_tree: dict[str, ProductCategory] = {
    k: ProductCategory.model_validate(v)
    for k, v in json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["categoryTree"])["Body"].read()
    ).items()
}
word_map: dict[str, list[str]] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["wordMap"])["Body"].read()
)
vector_words: list[str] = json.loads(
    s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["vectorWords"])["Body"].read()
)

# optional
try:
    brands: list[str] = json.loads(s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["brands"])["Body"].read())
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No brands file found")
    brands = []
try:
    singularize: dict[str, str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["singularize"])["Body"].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No singularize file found")
    singularize = {}
try:
    synonyms: dict[str, str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["synonyms"])["Body"].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No synonyms file found")
    synonyms = {}
try:
    descriptors: list[str] = json.loads(
        s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=config_paths["descriptors"])["Body"].read()
    )
except (KeyError, s3.exceptions.ClientError):
    logger.warning("No descriptors file found")
    descriptors = []

# load word vectors
WORDVECTORS_FILE_VEC = "/opt/wordvectors/small_embeddings-model.vec"
# noinspection PyTypeChecker
wordvectors: KeyedVectors = KeyedVectors.load(WORDVECTORS_FILE_VEC, mmap="r")

# preload vector_words from wordvectors
for w in vector_words:
    _ = wordvectors[w]

text_cleaner = TextCleaner(
    singularize=singularize, brands=brands, synonyms=synonyms, descriptors=descriptors, language="english"
)

metaclass_classifier = MetaclassClassifier(
    category_tree=category_tree,
    word_map=word_map,
    vector_words=vector_words,
    wordvectors=wordvectors,
    text_cleaner=text_cleaner,
)


@event_parser(model=ProductReadyForMetaclass)
def handler(event: ProductReadyForMetaclass, _):
    logger.debug(f"Event received {event.model_dump_json()}")
    demo = event.demo
    title_prediction = metaclass_classifier.classify(event.product.title)
    if event.product.short_description:
        short_description_prediction = metaclass_classifier.classify(event.product.short_description)
        # merge title_prediction and short_description_prediction
        prediction = MetaclassPrediction(
            possible_categories=list(
                set(title_prediction.possible_categories + short_description_prediction.possible_categories)
            ),
            clean_title=title_prediction.clean_title,
            findings=title_prediction.findings + short_description_prediction.findings,
        )
    else:
        prediction = title_prediction
    if not demo:
        prediction.clean_title = None
        prediction.findings = None
    logger.debug(f"Prediction {prediction.model_dump_json()}")
    return prediction.model_dump()