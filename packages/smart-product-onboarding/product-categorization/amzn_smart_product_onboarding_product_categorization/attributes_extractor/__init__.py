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
from amzn_smart_product_onboarding_core_utils.json_to_xml import json_to_xml
from botocore.exceptions import ClientError
from cachetools import TTLCache, cachedmethod

from amzn_smart_product_onboarding_product_categorization.structured_output import (
    get_structured_output,
    is_schema_too_complex,
)

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

        values = self._get_answer(prompt, category_id, category_schema)
        return Attributes(
            attributes=[
                Attribute(name=name, value="null" if value is None else value) for name, value in values.items()
            ]
        )

    def _get_answer(self, prompt: str, category_id: str, category_schema: CategorySchema) -> dict:
        """Ask with the enum schema, or with the string schema for categories Bedrock can't compile."""
        enums = category_id not in _CATEGORIES_NEEDING_STRING_SCHEMA
        try:
            return get_structured_output(
                self.bedrock_runtime_client,
                self.model_id,
                self.system_prompt,
                prompt,
                self.output_schema(category_schema, enums),
                "attributes",
                temperature=self.temperature,
            )
        except ClientError as e:
            if not (enums and is_schema_too_complex(e)):
                raise
            logger.warning({"schema_too_complex": category_id})
            _CATEGORIES_NEEDING_STRING_SCHEMA.add(category_id)
            return self._get_answer(prompt, category_id, category_schema)

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
    def output_schema(category_schema: CategorySchema, enums: bool = True) -> dict:
        """JSON schema with one required property per attribute: one of its listed values, or null. Without `enums`,
        the fallback for a category whose enum schema Bedrock can't compile, every attribute is a string or null.

        Null is an enum value rather than a "null" type, because Bedrock allows at most 16 union-typed properties.
        shortcut: GPC May 2026 has at most 16 attributes per category, so the fallback stays within that limit.
        """
        properties = {
            attribute["Title"]: (
                {"enum": [value["Title"] for value in attribute["Childs"]] + [None]}
                if enums and attribute.get("Childs")
                else {"type": ["string", "null"]}
            )
            for attribute in category_schema.attributes_schema
        }
        return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}
