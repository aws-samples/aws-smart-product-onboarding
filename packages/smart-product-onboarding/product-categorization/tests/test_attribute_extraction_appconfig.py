# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Tests for attribute extraction handler AppConfig integration.

Validates:
- Requirements 4.5: Handler uses AppConfig model_id and temperature when available
- Requirements 4.6: Handler falls back to env vars when AppConfig returns None
"""

import importlib
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

_ENV = {
    "AWS_LAMBDA_FUNCTION_NAME": "test-function",
    "AWS_REGION": "us-east-1",
    "CONFIG_BUCKET_NAME": "test-bucket",
    "BEDROCK_MODEL_ID": "env-var-model-id",
    "APPCONFIG_APPLICATION_ID": "app-id",
    "APPCONFIG_ENVIRONMENT_ID": "env-id",
    "APPCONFIG_CONFIGURATION_PROFILE_ID": "profile-id",
}

_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]

_HANDLER_MODULE = "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction"


@pytest.fixture()
def handler_module():
    """Import the attribute extraction handler module with all heavy dependencies mocked."""
    for mod_name in [_HANDLER_MODULE, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(mod_name, None)

    mock_s3_resource = MagicMock()
    mock_appconfig_client = MagicMock()

    def _fake_boto3_client(service_name, **kwargs):
        if service_name == "s3":
            return MagicMock()
        if service_name == "bedrock-runtime":
            return MagicMock()
        if service_name == "appconfigdata":
            return MagicMock()
        if service_name == "sts":
            return MagicMock()
        return MagicMock()

    with (
        patch.dict(os.environ, _ENV),
        patch("boto3.client", side_effect=_fake_boto3_client),
        patch("boto3.resource", return_value=mock_s3_resource),
    ):
        for mod_name in _BOTO3_HELPER_MODULES:
            importlib.import_module(mod_name)

        mod = importlib.import_module(_HANDLER_MODULE)
        mod.appconfig_client = mock_appconfig_client

    mod._mock_appconfig_client = mock_appconfig_client

    yield mod

    sys.modules.pop(_HANDLER_MODULE, None)


class TestAttributeExtractionHandlerAppConfigIntegration:
    """Test attribute extraction handler uses AppConfig values when available (Req 4.5)."""

    def test_handler_uses_appconfig_model_id_and_temperature(self, handler_module):
        """When AppConfig returns config, handler uses model_id and temperature from it."""
        from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigSettings

        appconfig_settings = AppConfigSettings(model_id="appconfig-model-id", temperature=0.3)
        handler_module._mock_appconfig_client.get_configuration.return_value = appconfig_settings

        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract_attributes.return_value = MagicMock(
            attributes=[], model_dump=lambda: {"attributes": []}
        )

        with patch(
            "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction.AttributesExtractor",
        ) as mock_extractor_cls:
            mock_extractor_cls.return_value = mock_extractor_instance

            event = {
                "product": {"title": "Test Product", "description": "A test product description"},
                "category": {
                    "predicted_category_id": "123",
                    "predicted_category_name": "Electronics",
                    "explanation": "test",
                },
            }

            handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("attributeExtraction")

        call_kwargs = mock_extractor_cls.call_args
        assert call_kwargs.kwargs["model_id"] == "appconfig-model-id"
        assert call_kwargs.kwargs["temperature"] == 0.3


class TestAttributeExtractionHandlerAppConfigFallback:
    """Test attribute extraction handler falls back to env vars when AppConfig returns None (Req 4.6)."""

    def test_handler_falls_back_to_env_var_when_appconfig_returns_none(self, handler_module):
        """When AppConfig returns None, handler uses BEDROCK_MODEL_ID env var and temperature 0."""
        handler_module._mock_appconfig_client.get_configuration.return_value = None

        mock_extractor_instance = MagicMock()
        mock_extractor_instance.extract_attributes.return_value = MagicMock(
            attributes=[], model_dump=lambda: {"attributes": []}
        )

        with patch(
            "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction.AttributesExtractor",
        ) as mock_extractor_cls:
            mock_extractor_cls.return_value = mock_extractor_instance

            event = {
                "product": {"title": "Test Product", "description": "A test product description"},
                "category": {
                    "predicted_category_id": "123",
                    "predicted_category_name": "Electronics",
                    "explanation": "test",
                },
            }

            handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("attributeExtraction")

        call_kwargs = mock_extractor_cls.call_args
        assert call_kwargs.kwargs["model_id"] == "env-var-model-id"
        assert call_kwargs.kwargs["temperature"] == 0
