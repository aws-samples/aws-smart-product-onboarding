# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Generate a product title and description from product images and optional metadata."""

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import TYPE_CHECKING

import jinja2
from amzn_smart_product_onboarding_core_utils.logger import logger

from amzn_smart_product_onboarding_product_categorization.structured_output import get_structured_output_with_usage

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
    from mypy_boto3_s3 import S3Client
else:
    BedrockRuntimeClient = object
    S3Client = object

PARAGRAPHS = {"short": "one paragraph", "medium": "three paragraphs", "long": "five paragraphs"}
# Image formats that Converse accepts, by content type.
IMAGE_FORMATS = {"image/jpeg": "jpeg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
SCHEMA = {
    "type": "object",
    "properties": {"title": {"type": "string"}, "description": {"type": "string"}},
    "required": ["title", "description"],
    "additionalProperties": False,
}


class BadRequestError(ValueError):
    """The request can't be served as given, such as an image that isn't a supported image type."""


@dataclass
class GeneratedProduct:
    title: str
    description: str
    usage: dict[str, int]


class ProductGenerator:
    def __init__(self, bedrock: "BedrockRuntimeClient", s3: "S3Client", image_bucket: str):
        self.bedrock = bedrock
        self.s3 = s3
        self.image_bucket = image_bucket
        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        environment = jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=jinja2.StrictUndefined,
        )
        self.template = environment.get_template("product_generation.jinja2")

    def generate(
        self,
        image_keys: list[str],
        model_id: str,
        temperature: float,
        language: str | None = None,
        description_length: str | None = None,
        metadata: str | None = None,
        examples: list[dict[str, str]] | None = None,
    ) -> GeneratedProduct:
        """Generate a title and description for the product in the images at `image_keys` in the image bucket.

        Raises:
            BadRequestError: An image isn't a supported image type, or the description length is unknown.
            ClientError: An image could not be read, or Bedrock refused the request.
            Any error from `get_structured_output_with_usage`.
        """
        prompt = self.prompt(len(image_keys), language, description_length, metadata, examples)
        images = self.images(image_keys)
        answer, usage = get_structured_output_with_usage(
            self.bedrock, model_id, None, prompt, SCHEMA, "product", temperature=temperature, images=images
        )
        return GeneratedProduct(title=answer["title"], description=answer["description"], usage=usage)

    def prompt(
        self,
        image_count: int,
        language: str | None = None,
        description_length: str | None = None,
        metadata: str | None = None,
        examples: list[dict[str, str]] | None = None,
    ) -> str:
        if description_length and description_length not in PARAGRAPHS:
            raise BadRequestError(f"Invalid description length: {description_length}")
        return self.template.render(
            metadata=metadata,
            examples=examples or [],
            language=language,
            paragraphs=PARAGRAPHS.get(description_length or ""),
            multiple_images=image_count > 1,
        )

    def images(self, keys: list[str]) -> list[dict]:
        """Read the images from S3 as Converse image blocks, in order."""
        with ThreadPoolExecutor(max_workers=8) as executor:
            return list(executor.map(self._image, keys))

    def _image(self, key: str) -> dict:
        image = self.s3.get_object(Bucket=self.image_bucket, Key=key)
        content_type = image.get("ContentType")
        logger.debug(f"Got {key} with type {content_type} and size {image.get('ContentLength')}")
        if content_type not in IMAGE_FORMATS:
            raise BadRequestError(f"Image {key} has an invalid content type: {content_type}")
        return {"image": {"format": IMAGE_FORMATS[content_type], "source": {"bytes": image["Body"].read()}}}
