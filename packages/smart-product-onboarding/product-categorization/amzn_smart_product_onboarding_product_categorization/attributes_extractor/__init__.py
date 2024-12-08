# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from abc import ABC
from botocore.exceptions import ClientError
from cachetools import cachedmethod, TTLCache
import io
import jinja2
import json
import operator
import os
from pydantic import ValidationError
import time
from typing import TYPE_CHECKING, Optional

from amzn_smart_product_onboarding_core_utils.exceptions import ModelResponseError, RateLimitError, RetryableError
from amzn_smart_product_onboarding_core_utils.xml_output import parse_response
from amzn_smart_product_onboarding_core_utils.json_to_xml import json_to_xml

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
    from mypy_boto3_s3.service_resource import Bucket
else:
    BedrockRuntimeClient = object
    Bucket = object

from amzn_smart_product_onboarding_core_utils.types import Attributes, CategorySchema, Product, CategorizationPrediction
from amzn_smart_product_onboarding_core_utils.logger import logger

logger.name = "AttributesExtractor"

EMPTY_RESPONSE = Attributes(attributes=[])


class CategorySchemaNotFound(Exception): ...


class SchemaRetriever(ABC):
    def get(self, category_id: str) -> CategorySchema: ...


class GPCSchemaRetriever(SchemaRetriever):
    def __init__(self, schema_storage: Bucket, schema_path: str, cache_timer=None):
        self.schema_path = schema_path
        self.schema_storage = schema_storage
        self.schema = None

        _cache_timer = cache_timer if cache_timer else time.monotonic
        self._cache = TTLCache(maxsize=10, ttl=300, timer=_cache_timer)

    @cachedmethod(cache=operator.attrgetter("_cache"))
    def _load_schema(
        self,
    ) -> None:
        schema_obj = io.BytesIO()
        try:
            self.schema_storage.download_fileobj(Key=self.schema_path, Fileobj=schema_obj)
            schema_obj.seek(0)
            self.schema = json.load(schema_obj)
        except ClientError as e:
            raise Exception(
                f"Failed to load schema from storage {self.schema_storage} and path {self.schema_path}: {str(e)}"
            )

    def get(self, category_id: str) -> Optional[CategorySchema]:
        self._load_schema()

        if category_id not in self.schema:
            logger.error(f"DID NOT FIND CATEGORY {category_id}")
            return None

        category_schema_dict = self.schema.get(category_id)
        return CategorySchema.model_validate(category_schema_dict)


class AttributesExtractor:
    response_open: str = "<response><scratchpad>"
    response_close: str = "</response>"

    def __init__(
        self,
        bedrock_runtime_client: BedrockRuntimeClient,
        schema_retriever: SchemaRetriever,
        model_id: Optional[str] = None,
    ):
        self.bedrock_runtime_client = bedrock_runtime_client
        self.schema_retriever = schema_retriever

        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        self.template = jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=jinja2.StrictUndefined,
        ).get_template("extract_attributes.jinja2")

        self.model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0" if model_id is None else model_id

    def extract_attributes(self, product: Product, category_id: str) -> Attributes:
        category_schema = self.schema_retriever.get(category_id)

        if category_schema is None:
            return EMPTY_RESPONSE

        logger.debug(f"CATEGORY SCHEMA: {category_schema.model_dump()}")

        if category_schema.attributes_schema is None:
            logger.warning(f"CATEGORY {category_schema.category_name} HAS NO ATTRIBUTE SCHEMA")
            return EMPTY_RESPONSE

        prompt = self.create_prompt(category_schema, product)

        messages = [
            {"role": "user", "content": [{"text": prompt}]},
            {"role": "assistant", "content": [{"text": self.response_open}]},
        ]

        try:
            response = self.bedrock_runtime_client.converse(
                modelId=self.model_id,
                inferenceConfig={"temperature": 0, "stopSequences": [self.response_close]},
                messages=messages,
            )
        except ClientError as e:
            # TODO: extract error handling to a decorator
            if e.response["Error"]["Code"] == "ThrottlingException":
                logger.error(e.response["Error"]["Code"])
                raise RateLimitError(e)
            elif e.response["Error"]["Code"] in (
                "ModelTimeoutException",
                "InternalServerException",
                "ServiceUnavailableException",
            ):
                logger.exception(e)
                raise RetryableError(e)
        logger.info({"usage": response["usage"]})
        attributes = self._parse_response(response)
        print(f"ATTRIBUTES ARE: {attributes}")

        return attributes

    def create_prompt(self, category_schema, product: Product) -> str:
        """Use Jinja2 to fill in a prompt from the `product_category` template."""
        prompt = self.template.render(
            category=category_schema.category_name,
            subcategory=category_schema.subcategory_name,
            attributes_schema=json_to_xml(category_schema.attributes_schema),
            product=product,
        )

        logger.debug(f"prompt: {prompt}")

        return prompt

    def _parse_response(self, response) -> Attributes:
        try:
            text = response["output"]["message"]["content"][0]["text"]
        except KeyError:
            logger.error(f"Failed to get prediction from response: {response}")
            raise ModelResponseError("Failed to get prediction from response")

        if response["stopReason"] == "stop_sequence":
            xml_response = self.response_open + text + self.response_close
        elif response["stopReason"] == "end_turn" and text.endswith(self.response_close):
            xml_response = self.response_open + text
        else:
            logger.error(f"Stop reason: {response['stopReason']}")
            raise ModelResponseError(f"Invalid stop reason: {response['stopReason']}")
        try:
            parsed_response = parse_response(xml_response)
            attributes = parsed_response["response"]["attributes"]["attribute"]
            attributes = [attributes] if not isinstance(attributes, list) else attributes
            return Attributes.model_validate({"attributes": attributes})
        except (ValueError, ValidationError, KeyError) as e:
            logger.exception(e)
            logger.error(f"Failed to parse extracted attributes from response: {xml_response}")
            raise ModelResponseError("Failed to parse extracted attributes from response")
