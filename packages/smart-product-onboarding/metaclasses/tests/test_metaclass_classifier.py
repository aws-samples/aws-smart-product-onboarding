# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest
from unittest.mock import Mock
import numpy as np
from gensim.models import KeyedVectors

from amzn_smart_product_onboarding_core_utils.types import (
    ProductCategory,
    MetaclassPrediction,
    WordFinding,
    BaseProductCategory,
)
from amzn_smart_product_onboarding_metaclasses.metaclass_classifier import MetaclassClassifier, LOW_THRESHOLD_SIMILARITY


@pytest.fixture
def mock_wordvectors():
    mock = Mock(spec=KeyedVectors)
    mock.distances.return_value = np.array([0.5, 0.7, 0.3])
    return mock


@pytest.fixture
def mock_text_cleaner():
    mock = Mock()
    mock.clean_text.return_value = "clean text"
    return mock


@pytest.fixture
def classifier(mock_wordvectors, mock_text_cleaner):
    category_tree = {
        "category1": ProductCategory(
            id="1",
            name="Category 1",
            description="Description for Category 1",
            full_path=[BaseProductCategory(id="root", name="Root"), BaseProductCategory(id="1", name="Category 1")],
            childs=[
                BaseProductCategory(id="1.1", name="Subcategory 1.1"),
                BaseProductCategory(id="1.2", name="Subcategory 1.2"),
            ],
        )
    }
    word_map = {"word1": ["category1"], "word2": ["category1", "category2"]}
    vector_words = ["word1", "word2", "word3"]
    return MetaclassClassifier(mock_wordvectors, mock_text_cleaner, category_tree, word_map, vector_words)


def test_classify(classifier, mock_text_cleaner):
    mock_text_cleaner.clean_text.return_value = "word1 word2 word3"
    result = classifier.classify("some text")

    assert isinstance(result, MetaclassPrediction)
    assert result.clean_title == "word1 word2 word3"
    assert set(result.possible_categories) == {"category1", "category2"}


def test_evaluate_text_category_list(classifier):
    words = ["word1", "word3", "word2"]
    result = classifier.evaluate_text_category_list(words)

    assert len(result) == 2
    assert all(isinstance(f, WordFinding) for f in result)
    assert all(f.type == "exact_match" for f in result)
    assert all(f.score == 1.0 for f in result)


def test_get_closest_category_words(classifier, mock_wordvectors):
    words = ["word4", "word5"]
    result = classifier.get_closest_category_words(words)

    assert all(isinstance(f, WordFinding) for f in result)
    assert all(f.type == "word_emb" for f in result)
    assert all(f.word in ["word1", "word3"] for f in result)


def test_get_possible_categories(classifier):
    findings = [
        WordFinding(position=0, type="exact_match", word="word1", score=1.0),
        WordFinding(position=1, type="word_emb", word="word2", score=0.8),
    ]
    result = classifier.get_possible_categories(findings)

    assert set(result) == {"category1", "category2"}


def test_classify_with_no_matches(classifier, mock_text_cleaner, mock_wordvectors):
    mock_text_cleaner.clean_text.return_value = "no match words"
    mock_wordvectors.distances.return_value = np.array([0.8, 0.7, 0.9])
    result = classifier.classify("some text")

    assert len(result.findings) == 1
    assert result.findings[0].type == "other"
    assert result.findings[0].score == LOW_THRESHOLD_SIMILARITY


def test_classify_with_exact_and_embedding_matches(classifier, mock_text_cleaner, mock_wordvectors):
    mock_text_cleaner.clean_text.return_value = "word1 unknown_word"
    mock_wordvectors.distances.return_value = np.array([0.5, 0.8, 0.7])
    result = classifier.classify("some text")

    assert len(result.findings) == 2
    assert result.findings[0].type == "exact_match"
    assert result.findings[1].type == "word_emb"
