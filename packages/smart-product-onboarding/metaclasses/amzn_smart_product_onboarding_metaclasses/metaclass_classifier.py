# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import numpy as np
from gensim.models import KeyedVectors

from amzn_smart_product_onboarding_core_utils.logger import logger
from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner
from amzn_smart_product_onboarding_core_utils.types import ProductCategory, MetaclassPrediction, WordFinding

WORD_LIMIT = 20

logger.name = "MetaclassClassifier"

LOW_THRESHOLD_SIMILARITY = 0.4


class MetaclassClassifier:
    def __init__(
        self,
        wordvectors: KeyedVectors,
        text_cleaner: TextCleaner,
        category_tree: dict[str, ProductCategory],
        word_map: dict[str, list[str]],
        vector_words: list[str],
    ):
        self.wordvectors = wordvectors
        self.text_cleaner = text_cleaner
        self.category_tree = category_tree
        self.word_map = word_map
        self.vector_words = vector_words

    def classify(self, text: str) -> MetaclassPrediction:
        clean_text = self.text_cleaner.clean_text(text)
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

        logger.debug(f"Step2. Evaluate embeddings matches from category list word by word")
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
        categories_found: list[WordFinding] = []
        for i, word in enumerate(words):
            try:
                distances = self.wordvectors.distances(word, self.vector_words)
            except KeyError:
                logger.warning(f"word not found in embeddings: {word}")
                continue
            indices = np.where(distances < 0.6)[0]
            for j in indices:
                category = self.vector_words[j]
                categories_found.append(
                    WordFinding(
                        position=i,
                        type="word_emb",
                        word=category,
                        score=1 - distances[j],
                    )
                )

        return categories_found

    def get_possible_categories(self, findings: list[WordFinding]) -> list[str]:
        """For each finding get the list of category IDs associated with each word."""
        possible = set()
        for finding in findings:
            possible.update(self.word_map.get(finding.word, []))

        return list(possible)
