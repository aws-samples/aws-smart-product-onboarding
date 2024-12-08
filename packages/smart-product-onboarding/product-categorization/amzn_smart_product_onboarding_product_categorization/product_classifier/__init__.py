# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os
from typing import Iterable, TYPE_CHECKING

import botocore.exceptions
import jinja2
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_random_exponential

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime.type_defs import ConverseResponseTypeDef, MessageTypeDef, MessageOutputTypeDef
else:
    ConverseResponseTypeDef = dict
    MessageTypeDef = dict
    MessageOutputTypeDef = dict
from pydantic import ValidationError

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import BedrockRuntimeClient
from amzn_smart_product_onboarding_core_utils.exceptions import (
    RetryableError,
    RateLimitError,
    ModelResponseError,
)
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.types import (
    ProductCategory,
    CategorizationPrediction,
    Product,
)
from amzn_smart_product_onboarding_core_utils.xml_output import parse_response

logger.name = "product_classifier"
DEFAULT_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"


class ProductClassifier:
    response_open = "<response>\n<thinking>"
    response_close = "</response>"

    def __init__(
        self,
        bedrock: BedrockRuntimeClient,
        category_tree: dict[str, ProductCategory],
        always_categories: list[str] = None,
        model_id: str = DEFAULT_MODEL_ID,
        include_prompt: bool = False,
    ):
        """
        :param bedrock: Bedrock Runtime Client
        :param category_tree: Mapping of category IDs to ProductCategory
        :param always_categories: List of category IDs of where titles are the name of the work.
        :param model_id: Amazon Bedrock model ID
        """
        self.category_tree = category_tree
        self.bedrock = bedrock
        self.always_categories = always_categories if always_categories else []
        self.model_id = model_id
        self.include_prompt = include_prompt

    def classify(
        self, product: Product, candidate_category_ids: list[str], include_prompt: bool = False, dryrun: bool = False
    ) -> CategorizationPrediction:
        # Get list of categories
        # Get category examples
        # Call LLM
        # Return predicted category and explanation
        all_candidate_categories_ids = set(candidate_category_ids + self.always_categories)
        candidate_categories = self.get_categories(all_candidate_categories_ids)
        prompt = self.create_prompt(product, candidate_categories)
        prediction = self.get_product_category(prompt, dryrun=dryrun)
        if self.include_prompt or include_prompt:
            prediction.prompt = prompt
        return prediction

    def get_categories(self, possible_categories: Iterable[str]) -> list[ProductCategory]:
        return [self.category_tree[cat_id] for cat_id in possible_categories]

    def create_prompt(self, product: Product, candidate_categories: Iterable[ProductCategory]) -> str:
        """Use Jinja2 to fill in a prompt from the `product_category` template."""
        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        template = jinja2.Environment(  # nosec B701 - template output is not used on a website
            loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), "prompt_templates")),
            trim_blocks=True,
            lstrip_blocks=True,
        ).get_template("product_category.jinja2")

        # nosemgrep: direct-use-of-jinja2 - jinja2 output is not rendered by a browser
        prompt = template.render(
            product=product,
            candidate_categories=candidate_categories,
        )
        logger.debug({"prompt": prompt})
        return prompt

    def get_product_category(self, prompt: str, dryrun: bool = False) -> CategorizationPrediction:
        messages = [
            {
                "role": "user",
                "content": [{"text": prompt}],
            },
        ]
        if not dryrun:
            response = self._get_model_response(messages)
        else:
            response = {
                "output": {
                    "message": {
                        "content": [
                            {
                                "text": """chain of thought</thinking>
                                        <prediction>
                                        <predicted_category_id>1234</predicted_category_id>
                                        <predicted_category_name>Test</predicted_category_name>
                                        <explanation>Test</explanation>
                                        </prediction>"""
                            }
                        ]
                    }
                },
                "stopReason": "stop_sequence",
            }
        text = self._extract_response_text(response)
        xml_response = self._build_xml_response(response, text)
        prediction = self._handle_prediction(xml_response, prompt)

        if not dryrun and not self.validate_prediction(prediction):
            full_response = xml_response
            response = self._handle_hallucination(full_response, prompt)
            text = self._extract_response_text(response)
            xml_response = self._build_xml_response(response, text)
            prediction = self._handle_prediction(xml_response, prompt)
            if not self.validate_prediction(prediction):
                logger.error(f"Hallucination detected twice: {full_response}")
                raise ModelResponseError("Hallucination detected")

        # set category name to full path
        prediction.predicted_category_name = " > ".join(
            [l.name for l in self.category_tree[prediction.predicted_category_id].full_path]
        )

        return prediction

    @retry(
        retry=retry_if_exception_type(RateLimitError),
        stop=stop_after_attempt(3),
        wait=wait_random_exponential(multiplier=2, max=60, min=30),
        reraise=True,
    )
    def _get_model_response(self, messages: list[MessageTypeDef | MessageOutputTypeDef]) -> ConverseResponseTypeDef:
        try:
            response = self.bedrock.converse(
                modelId=self.model_id,
                messages=messages
                + [
                    {
                        "role": "assistant",
                        "content": [{"text": self.response_open}],
                    },
                ],
                inferenceConfig={
                    "temperature": 0,
                    "stopSequences": [self.response_close],
                },
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

    def _extract_response_text(self, response: dict) -> str:
        try:
            return response["output"]["message"]["content"][0]["text"]
        except KeyError:
            logger.error(f"Failed to get prediction from response: {response}")
            raise ModelResponseError("Failed to get prediction from response")

    def _build_xml_response(self, response: dict, text: str) -> str:
        if response["stopReason"] == "stop_sequence":
            return self.response_open + text + self.response_close
        elif response["stopReason"] == "end_turn" and text.endswith(self.response_close):
            return self.response_open + text
        else:
            logger.error(f"Stop reason: {response['stopReason']}")
            raise ModelResponseError(response["stopReason"])

    def _handle_prediction(self, xml_response: str, prompt: str) -> CategorizationPrediction:
        try:
            parsed_response = parse_response(
                xml_response, cdata_tags=["predicted_category_id", "predicted_category_name", "explanation"]
            )
            prediction = CategorizationPrediction.model_validate(parsed_response["response"]["prediction"])

            if parsed_response.get("response", {}).get("thinking"):
                logger.debug({"Chain of Thought": parsed_response["response"]["thinking"]})

            return prediction

        except (ValidationError, KeyError) as e:
            logger.exception(e)
            logger.error(f"Failed to parse prediction from response: {xml_response}")
            raise ModelResponseError("Failed to parse prediction from response")

    def _handle_hallucination(self, full_response: str, prompt: str) -> ConverseResponseTypeDef:
        messages = [
            {
                "role": "user",
                "content": [{"text": prompt}],
            },
            {
                "role": "assistant",
                "content": [{"text": full_response}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "text": "The predicted_category_id does not exist in the list of candidate categories, or the "
                        "name of the predicted_category_id did not match the predicted_category_name. "
                        "Please provide a corrected response that ensures the predicted category exists "
                        "in the candidate list and matches the predicted name. Include both the corrected "
                        "category ID and name in your response in the same XML format."
                    }
                ],
            },
        ]
        return self._get_model_response(messages)

    def validate_prediction(self, prediction: CategorizationPrediction) -> bool:
        """Validate that the predicted category id is in the category tree and matches the predicted category name."""
        if prediction.predicted_category_id not in self.category_tree:
            logger.error(f"Predicted category id {prediction.predicted_category_id} not in category tree")
            return False
        # It's okay if predicted_category_name is just the name of the leaf or the entire path
        if not prediction.predicted_category_name.endswith(self.category_tree[prediction.predicted_category_id].name):
            logger.error(
                f"Predicted category name {prediction.predicted_category_name} does not match category name "
                f"{self.category_tree[prediction.predicted_category_id].name}"
            )
            return False
        return True
