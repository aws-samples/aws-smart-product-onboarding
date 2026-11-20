# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
from collections.abc import Iterable
from typing import TYPE_CHECKING

import botocore.exceptions
import jinja2
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime.type_defs import (
        ConverseResponseTypeDef,
        MessageOutputTypeDef,
        MessageTypeDef,
    )
else:
    ConverseResponseTypeDef = dict
    MessageTypeDef = dict
    MessageOutputTypeDef = dict
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    BedrockRuntimeClient,
    json_output_config,
    parse_json_response,
    prepare_converse_request,
)
from amzn_smart_product_onboarding_core_utils.exceptions import (
    ModelResponseError,
    RateLimitError,
    RetryableError,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    CategorizationPrediction,
    Product,
    ProductCategory,
)

logger.name = "product_classifier"
DEFAULT_MODEL_ID = "global.anthropic.claude-haiku-5-5"
# The prompt lets the model answer "other" when no candidate fits; the prediction then carries this ID.
NO_MATCH_CATEGORY_ID = "other"
NO_MATCH_CATEGORY_NAME = "Other"


class ProductClassifier:
    def __init__(
        self,
        bedrock: "BedrockRuntimeClient",
        category_tree: dict[str, ProductCategory],
        always_categories: list[str] = None,
        model_id: str = DEFAULT_MODEL_ID,
        include_prompt: bool = False,
        temperature: float = 0,
    ):
        """
        :param bedrock: Bedrock Runtime Client
        :param category_tree: Mapping of category IDs to ProductCategory
        :param always_categories: List of category IDs of where titles are the name of the work.
        :param model_id: Amazon Bedrock model ID
        :param temperature: Temperature for model inference
        """
        self.category_tree = category_tree
        self.bedrock = bedrock
        self.always_categories = always_categories if always_categories else []
        self.model_id = model_id
        self.include_prompt = include_prompt
        self.temperature = temperature
        self.system_prompt = self._template_environment().get_template("product_category_system.jinja2").render()

    def classify(
        self,
        product: Product,
        candidate_category_ids: list[str],
        include_prompt: bool = False,
        dryrun: bool = False,
    ) -> CategorizationPrediction:
        all_candidate_categories_ids = set(candidate_category_ids + self.always_categories)
        candidate_categories = self.get_categories(all_candidate_categories_ids)
        prompt = self.create_prompt(product, candidate_categories)
        # Sorted so the same candidates give the same schema, which Bedrock compiles once and caches.
        prediction = self.get_product_category(prompt, sorted(all_candidate_categories_ids), dryrun=dryrun)
        if self.include_prompt or include_prompt:
            prediction.prompt = prompt
        return prediction

    def get_categories(self, possible_categories: Iterable[str]) -> list[ProductCategory]:
        return [self.category_tree[cat_id] for cat_id in possible_categories]

    def create_prompt(self, product: Product, candidate_categories: Iterable[ProductCategory]) -> str:
        """Use Jinja2 to fill in a prompt from the `product_category` template."""
        template = self._template_environment().get_template("product_category.jinja2")

        # nosemgrep: direct-use-of-jinja2 - jinja2 output is not rendered by a browser
        prompt = template.render(
            product=product,
            candidate_categories=candidate_categories,
        )
        logger.debug({"prompt": prompt})
        return prompt

    @staticmethod
    def _template_environment() -> jinja2.Environment:
        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        return jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    @staticmethod
    def output_schema(candidate_category_ids: list[str]) -> dict:
        """The model writes its explanation and the category name before it picks the ID.

        With the ID first, the eval set lost three to five correct bricks out of 78.
        """
        return {
            "type": "object",
            "properties": {
                "explanation": {"type": "string"},
                "predicted_category_name": {"type": "string"},
                "predicted_category_id": {"type": "string", "enum": [*candidate_category_ids, NO_MATCH_CATEGORY_ID]},
            },
            "required": ["explanation", "predicted_category_name", "predicted_category_id"],
            "additionalProperties": False,
        }

    def get_product_category(
        self, prompt: str, candidate_category_ids: list[str], dryrun: bool = False
    ) -> CategorizationPrediction:
        messages = [{"role": "user", "content": [{"text": prompt}]}]
        if not dryrun:
            response = self._get_model_response(messages, self.output_schema(candidate_category_ids))
        else:
            response = {
                "output": {
                    "message": {
                        "content": [
                            {
                                "text": '{"explanation": "Test", "predicted_category_name": "Test", '
                                '"predicted_category_id": "1234"}'
                            }
                        ]
                    }
                },
                "stopReason": "end_turn",
            }
        result = parse_json_response(response)
        category_id = result["predicted_category_id"]
        if category_id == NO_MATCH_CATEGORY_ID:
            logger.info({"no_match": result["explanation"]})
            return CategorizationPrediction(
                predicted_category_id=NO_MATCH_CATEGORY_ID,
                predicted_category_name=NO_MATCH_CATEGORY_NAME,
                explanation=result["explanation"],
            )
        if category_id not in self.category_tree:
            logger.error({"predicted_category_id": category_id})
            raise ModelResponseError("Predicted category is not in the category tree")

        return CategorizationPrediction(
            predicted_category_id=category_id,
            predicted_category_name=" > ".join(l.name for l in self.category_tree[category_id].full_path),
            explanation=result["explanation"],
        )

    @retry(
        retry=retry_if_exception_type(RateLimitError),
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(multiplier=2, max=60, min=30),
        reraise=True,
    )
    def _get_model_response(
        self, messages: list[MessageTypeDef | MessageOutputTypeDef], schema: dict
    ) -> ConverseResponseTypeDef:
        try:
            request_messages, inference_config = prepare_converse_request(
                self.model_id, messages, temperature=self.temperature
            )
            response = self.bedrock.converse(
                modelId=self.model_id,
                system=[{"text": self.system_prompt}],
                messages=request_messages,
                inferenceConfig=inference_config,
                outputConfig=json_output_config(schema, "category_prediction"),
            )
            logger.info({"usage": response["usage"]})
            return response
        except botocore.exceptions.ClientError as e:
            self._handle_client_error(e)

    def _handle_client_error(self, error: botocore.exceptions.ClientError):
        if error.response["Error"]["Code"] == "ThrottlingException":
            logger.error(error.response["Error"]["Code"])
            raise RateLimitError(error)
        elif error.response["Error"]["Code"] in (
            "ModelTimeoutException",
            "InternalServerException",
            "ServiceUnavailableException",
        ):
            logger.exception(error)
            raise RetryableError(error)
