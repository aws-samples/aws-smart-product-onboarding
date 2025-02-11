# test_metaclass_classifier.py
from unittest.mock import Mock, patch

import pytest

from amzn_smart_product_onboarding_core_utils.exceptions import ModelResponseError
from amzn_smart_product_onboarding_core_utils.models import (
    MetaclassPrediction,
    WordFinding,
    Product,
)
from amzn_smart_product_onboarding_metaclasses.metaclass_classifier import (
    MetaclassClassifier,
)


@pytest.fixture
def mock_bedrock():
    return Mock()


@pytest.fixture
def mock_category_vector_index():
    index = Mock()
    index.search.return_value = [("category_word", 0.8)]
    return index


@pytest.fixture
def mock_word_embeddings_repo():
    repo = Mock()
    repo.get_vectors_by_words.return_value = [[0.1, 0.2, 0.3]]
    return repo


@pytest.fixture
def mock_text_cleaner():
    cleaner = Mock()
    cleaner.singularize_sentence.return_value = "cleaned text"
    return cleaner


@pytest.fixture
def word_map():
    return {
        "book": ["BOOK_CATEGORY"],
        "toy": ["TOY_CATEGORY"],
        "category_word": ["MATCHED_CATEGORY"],
    }


@pytest.fixture
def classifier(
    mock_category_vector_index,
    mock_word_embeddings_repo,
    mock_text_cleaner,
    word_map,
    mock_bedrock,
):
    return MetaclassClassifier(
        mock_category_vector_index,
        mock_word_embeddings_repo,
        mock_text_cleaner,
        word_map,
        mock_bedrock,
    )


def test_create_rephrase_prompt(classifier):
    product_text = "Sample product"
    prompt = classifier.create_rephrase_prompt(product_text)
    assert isinstance(prompt, str)
    assert "Sample product" in prompt


@patch(
    "amzn_smart_product_onboarding_metaclasses.metaclass_classifier.get_model_response"
)
def test_normalize_product_success(mock_get_response, classifier):
    product = Product(
        title="Test Product",
        description="Test Description",
        short_description="Short desc",
    )

    mock_response = {
        "usage": {
            "inputTokenCount": 100,
            "outputTokenCount": 50,
        },
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"text": 'normalized test product"}'}],
            },
        },
        "stopReason": "end_turn",
    }
    mock_get_response.return_value = mock_response

    result = classifier.normalize_product(product)
    assert result == "normalized test product"


@patch(
    "amzn_smart_product_onboarding_metaclasses.metaclass_classifier.get_model_response"
)
def test_normalize_product_error(mock_get_response, classifier):
    product = Product(
        title="Test Product",
        description="Test Description",
        short_description="Short desc",
    )

    mock_response = {"usage": {}, "completion": "invalid json"}
    mock_get_response.return_value = mock_response

    with pytest.raises(ModelResponseError):
        classifier.normalize_product(product)


def test_evaluate_text_category_list(classifier):
    words = ["book", "other", "toy"]
    results = classifier.evaluate_text_category_list(words)

    assert len(results) == 2
    assert results[0].word == "book"
    assert results[0].score == 1.0
    assert results[1].word == "toy"
    assert results[1].score == 1.0


def test_get_closest_category_words(classifier):
    words = ["test"]
    results = classifier.get_closest_category_words(words)

    assert len(results) == 1
    assert results[0].word == "category_word"
    assert results[0].score == 0.8


def test_get_possible_categories(classifier):
    findings = [
        WordFinding(position=0, type="exact_match", word="book", score=1.0),
        WordFinding(position=1, type="word_emb", word="category_word", score=0.8),
    ]

    categories = classifier.get_possible_categories(findings)
    assert set(categories) == {"BOOK_CATEGORY", "MATCHED_CATEGORY"}


def test_classify(classifier):
    product = Product(
        title="Test Book",
        description="Test Description",
        short_description="Short desc",
    )

    with patch.object(classifier, "normalize_product", return_value="test book"):
        result = classifier.classify(product)

        assert isinstance(result, MetaclassPrediction)
        assert result.clean_title == "cleaned text"
        assert len(result.findings) > 0


def test_classify_no_matches(classifier):
    product = Product(
        title="Unknown Product",
        description="Test Description",
        short_description="Short desc",
    )

    # Mock normalize_product to return text that won't match any categories
    with patch.object(classifier, "normalize_product", return_value="unknown product"):
        with patch.object(classifier, "get_closest_category_words", return_value=[]):
            result = classifier.classify(product)

            assert isinstance(result, MetaclassPrediction)
            assert len(result.findings) == 1
            assert result.findings[0].word == "other"
            assert result.findings[0].score == 0.4


def test_classify_word_limit(classifier):
    long_text = " ".join(["word"] * 25)  # Create text longer than WORD_LIMIT
    product = Product(
        title=long_text, description="Test Description", short_description="Short desc"
    )

    with patch.object(classifier, "normalize_product", return_value=long_text):
        result = classifier.classify(product)

        # Check that the number of processed words doesn't exceed WORD_LIMIT
        processed_words = len(result.clean_title.split())
        assert processed_words <= 20  # WORD_LIMIT is 20
