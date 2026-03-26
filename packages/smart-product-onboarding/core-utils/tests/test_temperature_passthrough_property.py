# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Feature: appconfig-runtime-configuration, Property 5: Temperature from configuration is passed to Bedrock API calls

**Validates: Requirements 5.1, 5.2, 5.3**

Property: For any temperature value in [0, 1] provided by the configuration,
each component (metaclass classification, product categorization, attribute extraction)
must pass that exact temperature value in the inferenceConfig of the Bedrock converse call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Property tests
# ---------------------------------------------------------------------------


class TestGetModelResponseTemperaturePassthrough:
    """Requirement 5.1 – get_model_response passes temperature to Bedrock."""

    @given(temperature=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
    @settings(max_examples=100)
    def test_temperature_in_inference_config(self, temperature: float) -> None:
        """
        Feature: appconfig-runtime-configuration,
        Property 5: Temperature from configuration is passed to Bedrock API calls
        **Validates: Requirements 5.1**
        """
        from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
            get_model_response,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        messages = [{"role": "user", "content": [{"text": "hello"}]}]

        get_model_response(
            mock_bedrock,
            "test-model-id",
            messages,
            temperature=temperature,
        )

        call_kwargs = mock_bedrock.converse.call_args
        actual_temp = call_kwargs.kwargs.get("inferenceConfig", {}).get("temperature")
        if actual_temp is None:
            actual_temp = call_kwargs[1].get("inferenceConfig", {}).get("temperature")

        assert actual_temp == temperature, f"Expected temperature {temperature} in inferenceConfig, got {actual_temp}"


class TestProductClassifierTemperaturePassthrough:
    """Requirement 5.2 – ProductClassifier passes constructor temperature to Bedrock."""

    @given(temperature=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
    @settings(max_examples=100)
    def test_temperature_in_converse_call(self, temperature: float) -> None:
        """
        Feature: appconfig-runtime-configuration,
        Property 5: Temperature from configuration is passed to Bedrock API calls
        **Validates: Requirements 5.2**
        """
        from amzn_smart_product_onboarding_product_categorization.product_classifier import (
            ProductClassifier,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = _make_converse_response()

        # Minimal category tree so validate_prediction succeeds
        mock_category = MagicMock()
        mock_category.name = "Test"
        mock_category.full_path = [mock_category]
        category_tree = {"1234": mock_category}

        classifier = ProductClassifier(
            bedrock=mock_bedrock,
            category_tree=category_tree,
            model_id="test-model-id",
            temperature=temperature,
        )

        # Call _get_model_response directly to isolate the temperature check
        messages = [{"role": "user", "content": [{"text": "test prompt"}]}]
        classifier._get_model_response(messages)

        call_kwargs = mock_bedrock.converse.call_args
        inference_config = call_kwargs.kwargs.get("inferenceConfig") or call_kwargs[1].get("inferenceConfig", {})
        actual_temp = inference_config.get("temperature")

        assert actual_temp == temperature, f"Expected temperature {temperature} in inferenceConfig, got {actual_temp}"


class TestAttributesExtractorTemperaturePassthrough:
    """Requirement 5.3 – AttributesExtractor passes constructor temperature to Bedrock."""

    @given(temperature=st.floats(min_value=0.0, max_value=1.0, allow_nan=False))
    @settings(max_examples=100)
    def test_temperature_in_converse_call(self, temperature: float) -> None:
        """
        Feature: appconfig-runtime-configuration,
        Property 5: Temperature from configuration is passed to Bedrock API calls
        **Validates: Requirements 5.3**
        """
        from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
            AttributesExtractor,
        )

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
            model_id="test-model-id",
            temperature=temperature,
        )

        # Patch create_prompt to avoid Jinja2 template file dependency
        with patch.object(extractor, "create_prompt", return_value="test prompt"):
            try:
                from amzn_smart_product_onboarding_core_utils.models import Product

                product = Product(title="Test", description="Test product")
                extractor.extract_attributes(product, "cat-123")
            except Exception:
                # We only care that converse was called with the right temperature;
                # response parsing may fail with our mock data and that's fine.
                pass

        assert mock_bedrock.converse.called, "converse was never called"

        call_kwargs = mock_bedrock.converse.call_args
        inference_config = call_kwargs.kwargs.get("inferenceConfig") or call_kwargs[1].get("inferenceConfig", {})
        actual_temp = inference_config.get("temperature")

        assert actual_temp == temperature, f"Expected temperature {temperature} in inferenceConfig, got {actual_temp}"
