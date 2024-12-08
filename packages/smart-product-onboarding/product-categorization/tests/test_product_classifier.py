# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest
from unittest.mock import Mock, call

from amzn_smart_product_onboarding_core_utils.exceptions import ModelResponseError
from amzn_smart_product_onboarding_core_utils.types import (
    Product,
    ProductCategory,
    BaseProductCategory,
    CategorizationPrediction,
)

from amzn_smart_product_onboarding_product_categorization.product_classifier import ProductClassifier


@pytest.fixture
def category_tree():
    return {
        "1": ProductCategory(
            id="1",
            name="Electronics",
            description="Electronic devices and accessories",
            full_path=[BaseProductCategory(id="1", name="Electronics")],
            childs=[BaseProductCategory(id="2", name="Smartphones")],
            examples=[],
        ),
        "2": ProductCategory(
            id="2",
            name="Smartphones",
            description="Mobile phones and accessories",
            full_path=[
                BaseProductCategory(id="1", name="Electronics"),
                BaseProductCategory(id="2", name="Smartphones"),
            ],
            childs=[],
            examples=[],
        ),
        "3": ProductCategory(
            id="3",
            name="Books",
            description="Physical and digital books",
            full_path=[BaseProductCategory(id="3", name="Books")],
            childs=[],
            examples=[],
        ),
    }


@pytest.fixture
def product_classifier(mock_bedrock, category_tree):
    return ProductClassifier(mock_bedrock, category_tree)


def test_get_categories(product_classifier):
    result = product_classifier.get_categories(["1", "2"])
    assert len(result) == 2
    assert result[0].id == "1"
    assert result[1].id == "2"


def test_create_prompt(product_classifier):
    product = Product(
        title="iPhone 12",
        description="Latest Apple smartphone",
        short_description="5G capable phone",
    )
    candidate_categories = [product_classifier.category_tree["2"]]

    prompt = product_classifier.create_prompt(product, candidate_categories)

    assert "iPhone 12" in prompt
    assert "Latest Apple smartphone" in prompt
    assert "5G capable phone" in prompt
    assert "Smartphones" in prompt


def test_get_product_category_success(product_classifier):
    product_classifier.bedrock.converse.return_value = {
        "output": {
            "message": {
                "content": [
                    {
                        "text": "chain of thought</thinking>"
                        "<prediction>"
                        "<predicted_category_id>2</predicted_category_id>"
                        "<predicted_category_name>Smartphones</predicted_category_name>"
                        "<explanation>This is a smartphone.</explanation>"
                        "</prediction>"
                    }
                ]
            }
        },
        "stopReason": "stop_sequence",
        "usage": {"inputTokens": 100, "outputTokens": 50},
    }

    result = product_classifier.get_product_category("Test prompt")

    assert isinstance(result, CategorizationPrediction)
    assert result.predicted_category_id == "2"
    assert result.predicted_category_name == "Electronics > Smartphones"
    assert result.explanation == "This is a smartphone."


def test_classify(product_classifier):
    product = Product(title="iPhone 12", description="Latest Apple smartphone")
    candidate_category_ids = ["1", "2"]

    product_classifier.create_prompt = Mock(return_value="Mocked prompt")
    product_classifier.get_product_category = Mock(
        return_value=CategorizationPrediction(
            predicted_category_id="2", predicted_category_name="Smartphones", explanation="This is a smartphone."
        )
    )

    result = product_classifier.classify(product, candidate_category_ids)

    assert isinstance(result, CategorizationPrediction)
    assert result.predicted_category_id == "2"
    assert result.predicted_category_name == "Smartphones"
    product_classifier.create_prompt.assert_called_once()
    product_classifier.get_product_category.assert_called_once_with("Mocked prompt", dryrun=False)


def test_classify_with_always_categories(product_classifier):
    product_classifier.always_categories = ["3"]
    product = Product(title="Book Title", description="A fiction book")
    candidate_category_ids = ["1", "2"]

    product_classifier.create_prompt = Mock(return_value="Mocked prompt")
    product_classifier.get_product_category = Mock(
        return_value=CategorizationPrediction(
            predicted_category_id="3", predicted_category_name="Books", explanation="This is a book."
        )
    )

    result = product_classifier.classify(product, candidate_category_ids)

    assert isinstance(result, CategorizationPrediction)
    assert result.predicted_category_id == "3"
    assert result.predicted_category_name == "Books"
    assert result.explanation == "This is a book."
    product_classifier.create_prompt.assert_called_once()
    product_classifier.get_product_category.assert_called_once_with("Mocked prompt", dryrun=False)

    # Check if the always_categories were included in the candidate categories
    _, args, _ = product_classifier.create_prompt.mock_calls[0]
    assert any(cat.id == "3" for cat in args[1])


def test_classify_with_include_prompt(product_classifier):
    product_classifier.include_prompt = True
    product = Product(title="iPhone 12", description="Latest Apple smartphone")
    candidate_category_ids = ["1", "2"]

    product_classifier.create_prompt = Mock(return_value="Mocked prompt")
    product_classifier.get_product_category = Mock(
        return_value=CategorizationPrediction(
            predicted_category_id="2", predicted_category_name="Smartphones", explanation="This is a smartphone."
        )
    )

    result = product_classifier.classify(product, candidate_category_ids)

    assert isinstance(result, CategorizationPrediction)
    assert result.predicted_category_id == "2"
    assert result.predicted_category_name == "Smartphones"
    assert result.prompt == "Mocked prompt"
    product_classifier.create_prompt.assert_called_once()
    product_classifier.get_product_category.assert_called_once_with("Mocked prompt", dryrun=False)


def test_classify_with_hallucination(product_classifier):
    prompt = "Mocked prompt"
    product_classifier._get_model_response = Mock(
        return_value={
            "output": {
                "message": {
                    "content": [
                        {
                            "text": "chain of thought</thinking>"
                            "<prediction>"
                            "<predicted_category_id>42</predicted_category_id>"
                            "<predicted_category_name>Smartphones</predicted_category_name>"
                            "<explanation>This is a smartphone.</explanation>"
                            "</prediction>"
                        }
                    ]
                }
            },
            "stopReason": "stop_sequence",
            "usage": {"inputTokens": 100, "outputTokens": 50},
        }
    )

    with pytest.raises(ModelResponseError) as excinfo:
        product_classifier.get_product_category(prompt)
    assert str(excinfo.value) == "Hallucination detected"
    product_classifier._get_model_response.assert_has_calls(
        [
            call(
                [
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    },
                ]
            ),
            call(
                [
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    },
                    {
                        "role": "assistant",
                        "content": [
                            {
                                "text": "<response>\n<thinking>chain of thought</thinking>"
                                "<prediction>"
                                "<predicted_category_id>42</predicted_category_id>"
                                "<predicted_category_name>Smartphones</predicted_category_name>"
                                "<explanation>This is a smartphone.</explanation>"
                                "</prediction></response>"
                            }
                        ],
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
            ),
        ]
    )


def test_validate_prediction_matches_leaf_name(product_classifier):
    prediction = CategorizationPrediction(
        predicted_category_id="2", predicted_category_name="Smartphones", explanation="This is a smartphone."
    )

    result = product_classifier.validate_prediction(prediction)

    assert result is True


def test_validate_prediction_matches_full_path_name(product_classifier):
    prediction = CategorizationPrediction(
        predicted_category_id="2",
        predicted_category_name="Electronics > Smartphones",
        explanation="This is a smartphone.",
    )

    result = product_classifier.validate_prediction(prediction)

    assert result is True


def test_validate_prediction_does_not_match_leaf_name(product_classifier):
    prediction = CategorizationPrediction(
        predicted_category_id="2", predicted_category_name="Electronics", explanation="This is a smartphone."
    )

    result = product_classifier.validate_prediction(prediction)

    assert result is False


def test_validate_prediction_does_not_match_id(product_classifier):
    prediction = CategorizationPrediction(
        predicted_category_id="42", predicted_category_name="Smartphones", explanation="This is a smartphone."
    )

    result = product_classifier.validate_prediction(prediction)

    assert result is False
