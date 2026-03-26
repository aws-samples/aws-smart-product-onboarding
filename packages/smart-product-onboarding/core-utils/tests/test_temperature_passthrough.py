# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Unit tests verifying temperature is passed through to Bedrock calls.

Validates: Requirements 5.1, 5.2, 5.3
"""

from __future__ import annotations

import contextlib
from unittest.mock import MagicMock, patch


def _make_converse_response(stop_reason: str = "stop_sequence") -> dict:
    """Return a minimal valid Bedrock converse response."""
    return {
        "output": {
            "message": {
                "content": [{"text": "mock response"}],
            }
        },
        "stopReason": stop_reason,
        "usage": {"inputTokens": 10, "outputTokens": 5, "totalTokens": 15},
    }


class TestGetModelResponseTemperature:
    """Requirement 5.1 – get_model_response passes temperature to Bedrock."""

    def test_custom_temperature_passed_to_inference_config(self) -> None:
        """get_model_response with temperature=0.7 passes 0.7 in inferenceConfig."""
        from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
            get_model_response,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()
        messages = [{"role": "user", "content": [{"text": "hello"}]}]

        get_model_response(mock_bedrock, "test-model", messages, temperature=0.7)

        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0.7

    def test_default_temperature_is_zero(self) -> None:
        """get_model_response without explicit temperature defaults to 0."""
        from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
            get_model_response,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()
        messages = [{"role": "user", "content": [{"text": "hello"}]}]

        get_model_response(mock_bedrock, "test-model", messages)

        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0


class TestProductClassifierTemperature:
    """Requirement 5.2 – ProductClassifier passes constructor temperature to Bedrock."""

    def test_custom_temperature_passed_to_converse(self) -> None:
        """ProductClassifier(temperature=0.5) passes 0.5 in inferenceConfig."""
        from amzn_smart_product_onboarding_product_categorization.product_classifier import (
            ProductClassifier,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        mock_category = MagicMock()
        mock_category.name = "Test"
        mock_category.full_path = [mock_category]
        category_tree = {"1234": mock_category}

        classifier = ProductClassifier(
            bedrock=mock_bedrock,
            category_tree=category_tree,
            model_id="test-model",
            temperature=0.5,
        )

        messages = [{"role": "user", "content": [{"text": "test"}]}]
        classifier._get_model_response(messages)

        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0.5

    def test_default_temperature_is_zero(self) -> None:
        """ProductClassifier without explicit temperature defaults to 0."""
        from amzn_smart_product_onboarding_product_categorization.product_classifier import (
            ProductClassifier,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        mock_category = MagicMock()
        mock_category.name = "Test"
        mock_category.full_path = [mock_category]
        category_tree = {"1234": mock_category}

        classifier = ProductClassifier(
            bedrock=mock_bedrock,
            category_tree=category_tree,
            model_id="test-model",
        )

        messages = [{"role": "user", "content": [{"text": "test"}]}]
        classifier._get_model_response(messages)

        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0


class TestAttributesExtractorTemperature:
    """Requirement 5.3 – AttributesExtractor passes constructor temperature to Bedrock."""

    def test_custom_temperature_passed_to_converse(self) -> None:
        """AttributesExtractor(temperature=0.3) passes 0.3 in inferenceConfig."""
        from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
            AttributesExtractor,
        )

        from amzn_smart_product_onboarding_core_utils.models import Product

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        mock_schema_retriever = MagicMock()
        mock_category_schema = MagicMock()
        mock_category_schema.category_name = "Test Category"
        mock_category_schema.subcategory_name = "Test Sub"
        mock_category_schema.attributes_schema = {"attr1": {"type": "string"}}
        mock_schema_retriever.get.return_value = mock_category_schema

        extractor = AttributesExtractor(
            bedrock_runtime_client=mock_bedrock,
            schema_retriever=mock_schema_retriever,
            model_id="test-model",
            temperature=0.3,
        )

        with patch.object(extractor, "create_prompt", return_value="test prompt"):
            product = Product(title="Test", description="Test product")
            with contextlib.suppress(Exception):
                extractor.extract_attributes(product, "cat-123")

        assert mock_bedrock.converse.called
        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0.3

    def test_default_temperature_is_zero(self) -> None:
        """AttributesExtractor without explicit temperature defaults to 0."""
        from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
            AttributesExtractor,
        )

        from amzn_smart_product_onboarding_core_utils.models import Product

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        mock_schema_retriever = MagicMock()
        mock_category_schema = MagicMock()
        mock_category_schema.category_name = "Test Category"
        mock_category_schema.subcategory_name = "Test Sub"
        mock_category_schema.attributes_schema = {"attr1": {"type": "string"}}
        mock_schema_retriever.get.return_value = mock_category_schema

        extractor = AttributesExtractor(
            bedrock_runtime_client=mock_bedrock,
            schema_retriever=mock_schema_retriever,
            model_id="test-model",
        )

        with patch.object(extractor, "create_prompt", return_value="test prompt"):
            product = Product(title="Test", description="Test product")
            with contextlib.suppress(Exception):
                extractor.extract_attributes(product, "cat-123")

        assert mock_bedrock.converse.called
        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs["inferenceConfig"]["temperature"]
        assert actual_temp == 0
