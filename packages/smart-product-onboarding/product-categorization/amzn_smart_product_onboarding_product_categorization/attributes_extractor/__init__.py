# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import io
import json
import operator
import os
import time
from abc import ABC
from typing import TYPE_CHECKING

import jinja2
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    complete_response,
    extract_response_text,
    prepare_converse_request,
)
from amzn_smart_product_onboarding_core_utils.exceptions import (
    ModelResponseError,
    RateLimitError,
    RetryableError,
)
from amzn_smart_product_onboarding_core_utils.json_to_xml import json_to_xml
from amzn_smart_product_onboarding_core_utils.xml_output import parse_response
from botocore.exceptions import ClientError
from cachetools import TTLCache, cachedmethod
from pydantic import ValidationError

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
    from mypy_boto3_s3.service_resource import Bucket
else:
    BedrockRuntimeClient = object
    Bucket = object

from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    Attributes,
    CategorySchema,
    Product,
)

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

    def get(self, category_id: str) -> CategorySchema | None:
        self._load_schema()

        if category_id not in self.schema:
            logger.error(f"DID NOT FIND CATEGORY {category_id}")
            return None

        category_schema_dict = self.schema.get(category_id)
        return CategorySchema.model_validate(category_schema_dict)


class AttributesExtractor:
    response_open: str = "<response>"
    response_close: str = "</response>"

    def __init__(
        self,
        bedrock_runtime_client: "BedrockRuntimeClient",
        schema_retriever: SchemaRetriever,
        model_id: str | None = None,
        temperature: float = 0,
    ):
        self.bedrock_runtime_client = bedrock_runtime_client
        self.schema_retriever = schema_retriever
        self.temperature = temperature

        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        self.template = jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=jinja2.StrictUndefined,
        ).get_template("extract_attributes.jinja2")

        self.model_id = "global.anthropic.claude-sonnet-5-5" if model_id is None else model_id

    def extract_attributes(self, product: Product, category_id: str) -> Attributes:
        category_schema = self.schema_retriever.get(category_id)

        if category_schema is None:
            return EMPTY_RESPONSE

        logger.debug(f"CATEGORY SCHEMA: {category_schema.model_dump()}")

        if category_schema.attributes_schema is None:
            logger.warning(f"CATEGORY {category_schema.category_name} HAS NO ATTRIBUTE SCHEMA")
            return EMPTY_RESPONSE

        prompt = self.create_prompt(category_schema, product)

        messages, inference_config = prepare_converse_request(
            self.model_id,
            [{"role": "user", "content": [{"text": prompt}]}],
            self.response_open,
            self.response_close,
            self.temperature,
        )

        try:
            response = self.bedrock_runtime_client.converse(
                modelId=self.model_id,
                inferenceConfig=inference_config,
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
        text = extract_response_text(response)

        xml_response = complete_response(
            text, response["stopReason"], self.model_id, self.response_open, self.response_close
        )
        if xml_response is None:
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
