# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Tests for categorization handler AppConfig integration.

Validates:
- Requirements 4.5: Handler uses AppConfig model_id and temperature when available
- Requirements 4.6: Handler falls back to env vars when AppConfig returns None
"""

import importlib
import json
import os
import sys
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest

_ENV = {
    "AWS_LAMBDA_FUNCTION_NAME": "test-function",
    "AWS_REGION": "us-east-1",
    "CONFIG_BUCKET_NAME": "test-bucket",
    "CONFIG_PATHS_PARAM": "/test/config-paths",
    "BEDROCK_MODEL_ID": "env-var-model-id",
    "APPCONFIG_APPLICATION_ID": "app-id",
    "APPCONFIG_ENVIRONMENT_ID": "env-id",
    "APPCONFIG_CONFIGURATION_PROFILE_ID": "profile-id",
}

_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]

_HANDLER_MODULE = "amzn_smart_product_onboarding_product_categorization.aws_lambda.categorization"


def _build_s3_body(data) -> dict:
    body = BytesIO(json.dumps(data).encode())
    return {"Body": body}


def _make_mock_s3():
    mock_s3 = MagicMock()
    mock_s3.get_object.side_effect = lambda **kwargs: _build_s3_body(
        {
            "data/tree.json": {
                "1": {
                    "id": "1",
                    "name": "Electronics",
                    "full_path": [{"id": "1", "name": "Electronics"}],
                    "childs": [],
                    "examples": [],
                }
            },
            "data/always.json": [],
        }.get(kwargs["Key"], {})
    )
    return mock_s3


def _make_mock_ssm():
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.return_value = {
        "Parameter": {"Value": json.dumps({"categoryTree": "data/tree.json", "alwaysCategories": "data/always.json"})}
    }
    return mock_ssm


@pytest.fixture()
def handler_module():
    """Import the categorization handler module with all heavy dependencies mocked."""
    for mod_name in [_HANDLER_MODULE, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(mod_name, None)

    mock_ssm = _make_mock_ssm()
    mock_s3 = _make_mock_s3()
    mock_appconfig_client = MagicMock()

    def _fake_boto3_client(service_name, **kwargs):
        if service_name == "ssm":
            return mock_ssm
        if service_name == "s3":
            return mock_s3
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
        patch("boto3.resource", return_value=MagicMock()),
    ):
        for mod_name in _BOTO3_HELPER_MODULES:
            importlib.import_module(mod_name)

        mod = importlib.import_module(_HANDLER_MODULE)
        mod.appconfig_client = mock_appconfig_client

    mod._mock_appconfig_client = mock_appconfig_client

    yield mod

    sys.modules.pop(_HANDLER_MODULE, None)


class TestCategorizationHandlerAppConfigIntegration:
    """Test categorization handler uses AppConfig values when available (Req 4.5)."""

    def test_handler_uses_appconfig_model_id_and_temperature(self, handler_module):
        """When AppConfig returns config, handler uses model_id and temperature from it."""
        from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigSettings

        appconfig_settings = AppConfigSettings(model_id="appconfig-model-id", temperature=0.5)
        handler_module._mock_appconfig_client.get_configuration.return_value = appconfig_settings

        mock_prediction = MagicMock()
        mock_prediction.model_dump_json.return_value = "{}"
        mock_prediction.model_dump.return_value = {
            "predicted_category_id": "1",
            "predicted_category_name": "Electronics",
            "explanation": "test",
            "prompt": None,
        }
        handler_module.product_classifier.classify = MagicMock(return_value=mock_prediction)

        event = {
            "product": {"title": "Test Product", "description": "A test product description"},
            "metaclass": {"possible_categories": ["1"]},
            "demo": False,
            "dryrun": False,
        }

        handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("productCategorization")
        assert handler_module.product_classifier.model_id == "appconfig-model-id"
        assert handler_module.product_classifier.temperature == 0.5


class TestCategorizationHandlerAppConfigFallback:
    """Test categorization handler falls back to env vars when AppConfig returns None (Req 4.6)."""

    def test_handler_falls_back_to_env_var_when_appconfig_returns_none(self, handler_module):
        """When AppConfig returns None, handler uses BEDROCK_MODEL_ID env var and temperature 0."""
        handler_module._mock_appconfig_client.get_configuration.return_value = None

        mock_prediction = MagicMock()
        mock_prediction.model_dump_json.return_value = "{}"
        mock_prediction.model_dump.return_value = {
            "predicted_category_id": "1",
            "predicted_category_name": "Electronics",
            "explanation": "test",
            "prompt": None,
        }
        handler_module.product_classifier.classify = MagicMock(return_value=mock_prediction)

        event = {
            "product": {"title": "Test Product", "description": "A test product description"},
            "metaclass": {"possible_categories": ["1"]},
            "demo": False,
            "dryrun": False,
        }

        handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("productCategorization")
        assert handler_module.product_classifier.model_id == "env-var-model-id"
        assert handler_module.product_classifier.temperature == 0
