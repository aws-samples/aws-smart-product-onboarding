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
    json_output_config,
    parse_json_response,
    prepare_converse_request,
)
from amzn_smart_product_onboarding_core_utils.exceptions import (
    RateLimitError,
    RetryableError,
)
from amzn_smart_product_onboarding_core_utils.json_to_xml import json_to_xml
from botocore.exceptions import ClientError
from cachetools import TTLCache, cachedmethod

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime.client import BedrockRuntimeClient
    from mypy_boto3_s3.service_resource import Bucket
else:
    BedrockRuntimeClient = object
    Bucket = object

from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    Attribute,
    Attributes,
    CategorySchema,
    Product,
)

logger.name = "AttributesExtractor"

EMPTY_RESPONSE = Attributes(attributes=[])

# Categories whose enum schema Bedrock refused to compile, kept for the life of the process.
_CATEGORIES_NEEDING_STRING_SCHEMA: set[str] = set()


def _is_schema_too_complex(error: ClientError) -> bool:
    return error.response["Error"]["Code"] == "ValidationException" and "Schema is too complex" in error.response[
        "Error"
    ].get("Message", "")


def _object_schema(properties: dict) -> dict:
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


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
        environment = jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=jinja2.StrictUndefined,
        )
        self.template = environment.get_template("extract_attributes.jinja2")
        self.system_prompt = environment.get_template("extract_attributes_system.jinja2").render()

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
            temperature=self.temperature,
        )
        request = {
            "modelId": self.model_id,
            "system": [{"text": self.system_prompt}],
            "inferenceConfig": inference_config,
            "messages": messages,
        }

        try:
            response = self._converse(request, category_id, category_schema)
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
            raise
        logger.info({"usage": response["usage"]})
        attributes = self._parse_response(response)
        print(f"ATTRIBUTES ARE: {attributes}")

        return attributes

    def _converse(self, request: dict, category_id: str, category_schema: CategorySchema) -> dict:
        """Call Converse with the enum schema, or with the string schema for categories Bedrock can't compile."""
        if category_id not in _CATEGORIES_NEEDING_STRING_SCHEMA:
            try:
                return self.bedrock_runtime_client.converse(
                    **request, outputConfig=json_output_config(self.output_schema(category_schema), "attributes")
                )
            except ClientError as e:
                if not _is_schema_too_complex(e):
                    raise
                logger.warning({"schema_too_complex": category_id})
                _CATEGORIES_NEEDING_STRING_SCHEMA.add(category_id)
        return self.bedrock_runtime_client.converse(
            **request, outputConfig=json_output_config(self.string_output_schema(category_schema), "attributes")
        )

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

    @staticmethod
    def output_schema(category_schema: CategorySchema) -> dict:
        """JSON schema with one required property per attribute: one of its listed values, or null.

        Null is an enum value rather than a "null" type, because Bedrock allows at most 16 union-typed properties.
        """
        properties = {
            attribute["Title"]: (
                {"enum": [value["Title"] for value in attribute["Childs"]] + [None]}
                if attribute.get("Childs")
                else {"type": ["string", "null"]}
            )
            for attribute in category_schema.attributes_schema
        }
        return _object_schema(properties)

    @staticmethod
    def string_output_schema(category_schema: CategorySchema) -> dict:
        """Fallback schema for categories whose enum schema Bedrock can't compile: each attribute is a string or null.

        shortcut: more than 16 attributes would exceed Bedrock's union-type limit; GPC May 2026 has at most 16.
        """
        return _object_schema(
            {attribute["Title"]: {"type": ["string", "null"]} for attribute in category_schema.attributes_schema}
        )

    def _parse_response(self, response) -> Attributes:
        values = parse_json_response(response)
        return Attributes(
            attributes=[
                Attribute(name=name, value="null" if value is None else value) for name, value in values.items()
            ]
        )
