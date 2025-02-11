# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import json
import os
from typing import TYPE_CHECKING

import jinja2

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    get_model_response,
    build_full_response,
)
from amzn_smart_product_onboarding_core_utils.exceptions import ModelResponseError
from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_core_utils.models import (
    MetaclassPrediction,
    WordFinding,
    Product,
)
from amzn_smart_product_onboarding_metaclasses.VectorRepository import VectorRepository
from amzn_smart_product_onboarding_metaclasses.category_vector_index import (
    CategoryVectorIndex,
)
from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner

MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "us.amazon.nova-micro-v1:0")

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import (
        BedrockRuntimeClient,
    )

WORD_LIMIT = 20

logger.name = "MetaclassClassifier"

LOW_THRESHOLD_SIMILARITY = 0.4


class MetaclassClassifier:
    def __init__(
        self,
        category_vector_index: CategoryVectorIndex,
        word_embeddings_repo: VectorRepository,
        text_cleaner: TextCleaner,
        word_map: dict[str, list[str]],
        bedrock: "BedrockRuntimeClient",
        language: str = "english",
    ):
        self.category_vector_index = category_vector_index
        self.word_embeddings = word_embeddings_repo
        self.text_cleaner = text_cleaner
        self.word_map = word_map
        self.bedrock = bedrock
        self.language = language

    def create_rephrase_prompt(
        self,
        product_text: str,
    ) -> str:
        """Use Jinja2 to fill in a prompt from the `product_category` template."""
        # nosemgrep: direct-use-of-jinja2,missing-autoescape-disabled - jinja2 output is not rendered by a browser
        template = (
            #  amazonq-ignore-next-line
            jinja2.Environment(  # nosec B701 - template output is not used on a website
                loader=jinja2.FileSystemLoader(
                    os.path.join(os.path.dirname(__file__), "prompt_templates")
                ),
                trim_blocks=True,
                lstrip_blocks=True,
            ).get_template("rephrase.jinja2")
        )

        # nosemgrep: direct-use-of-jinja2 - jinja2 output is not rendered by a browser
        prompt = template.render(
            product_text=product_text,
            language=self.language,
        )
        logger.debug({"prompt": prompt})
        return prompt

    def normalize_product(self, product: Product) -> str:
        response_open = '{"normalized_title": "'
        response_close = '"}'

        product_text = "\n".join(
            [product.title, product.short_description or "", product.description]
        )
        prompt = self.create_rephrase_prompt(product_text)
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "text": prompt,
                    }
                ],
            },
        ]

        response = get_model_response(
            self.bedrock,
            MODEL_ID,
            messages,
            response_open,
            response_close,
        )
        logger.info({"usage": response["usage"]})
        text = build_full_response(response, response_open, response_close)
        logger.debug({"response_text": text})
        try:
            r = json.loads(text)
            return r["normalized_title"]
        except (json.JSONDecodeError, KeyError) as e:
            logger.error({"error": e, "response": text})
            raise ModelResponseError("Error parsing response from model")

    def classify(self, product: Product) -> MetaclassPrediction:
        rephrased = self.normalize_product(product)
        logger.info(f"Rephrased title: {rephrased}")
        clean_text = rephrased.lower()
        clean_text = self.text_cleaner.singularize_sentence(clean_text)
        logger.info(f"Clean text: {clean_text}")
        words = clean_text.split()
        if len(words) > WORD_LIMIT:
            logger.warn(f"Truncating text at {WORD_LIMIT} words")
            words = words[:WORD_LIMIT]

        word_findings: list[WordFinding] = []
        logger.debug(f"Step1. Evaluate exact match from category list")
        word_findings.extend(self.evaluate_text_category_list(words))

        for f in word_findings:
            words.remove(f.word)

        logger.debug(
            f"Step2. Evaluate embeddings matches from category list word by word"
        )
        word_findings.extend(self.get_closest_category_words(words))

        if not len(word_findings):
            word_findings.append(
                WordFinding(
                    position=-1,
                    type="other",
                    word="other",
                    score=LOW_THRESHOLD_SIMILARITY,
                )
            )

        word_findings = sorted(word_findings, key=lambda x: x.score, reverse=True)
        possible_categories = self.get_possible_categories(word_findings)

        return MetaclassPrediction(
            possible_categories=possible_categories,
            clean_title=clean_text,
            findings=word_findings,
        )

    def evaluate_text_category_list(self, words: list[str]) -> list[WordFinding]:
        """
        Check the words in the cleaned text against the category words. Return any that are an exact match.
        """
        categories_found: list[WordFinding] = []
        for i, word in enumerate(words):
            if word in self.word_map:
                categories_found.append(
                    WordFinding(
                        position=i,
                        type="exact_match",
                        word=word,
                        score=1.0,
                    )
                )

        return categories_found

    def get_closest_category_words(self, words: list[str]) -> list[WordFinding]:
        """
        Check each word for matching category words using vector embeddings.
        """
        word_findings: list[WordFinding] = []
        word_vectors = self.word_embeddings.get_vectors_by_words(words)
        for i, vector in enumerate(word_vectors):
            if vector is None:
                continue
            results = self.category_vector_index.search(vector, 1, 0.4)
            for word, distance in results:
                word_findings.append(
                    WordFinding(
                        position=i,
                        type="word_emb",
                        word=word,
                        score=distance,
                    )
                )

        return word_findings

    def get_possible_categories(self, findings: list[WordFinding]) -> list[str]:
        """For each finding get the list of category IDs associated with each word."""
        possible = set()
        for finding in findings:
            possible.update(self.word_map.get(finding.word, []))

        return list(possible)
