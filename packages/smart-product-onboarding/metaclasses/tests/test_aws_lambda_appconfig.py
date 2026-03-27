# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Tests for metaclass handler AppConfig integration.

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

# ---------------------------------------------------------------------------
# Module-level patching: the metaclass handler performs heavy initialization
# at import time (SSM, S3, DynamoDB calls). We must mock all of that before
# importing the handler module.
# ---------------------------------------------------------------------------

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

# Modules that need to be purged and re-imported under mocks
_BOTO3_HELPER_MODULES = [
    "amzn_smart_product_onboarding_core_utils.boto3_helper.ssm_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.dynamodb_client",
    "amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client",
]

_HANDLER_MODULE = "amzn_smart_product_onboarding_metaclasses.aws_lambda"


def _build_s3_body(data) -> dict:
    body = BytesIO(json.dumps(data).encode())
    return {"Body": body}


class _FakeClientError(Exception):
    """Stand-in for botocore ClientError so `except s3.exceptions.ClientError` works."""


def _make_mock_s3():
    mock_s3 = MagicMock()
    mock_s3.get_object.side_effect = lambda **kwargs: _build_s3_body(
        {
            "data/word_map.json": {"word": ["cat1"]},
            "data/category_vectors.json": {"cat1": [0.1] * 300},
        }.get(kwargs["Key"], [])
    )
    # The handler catches `s3.exceptions.ClientError` — must be a real exception class
    mock_s3.exceptions.ClientError = _FakeClientError
    return mock_s3


def _make_mock_ssm():
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.return_value = {
        "Parameter": {
            "Value": json.dumps(
                {
                    "wordMap": "data/word_map.json",
                    "categoryVectors": "data/category_vectors.json",
                    "language": "english",
                    "wordEmbeddingsTable": "word-embeddings-table",
                }
            )
        }
    }
    return mock_ssm


@pytest.fixture()
def handler_module():
    """Import the metaclass handler module with all heavy dependencies mocked."""
    # Purge cached modules so they re-execute under our patches
    for mod_name in [_HANDLER_MODULE, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(mod_name, None)

    mock_ssm = _make_mock_ssm()
    mock_s3 = _make_mock_s3()
    mock_appconfig_client = MagicMock()

    # We need to control what boto3.client / boto3.resource return per service.
    def _fake_boto3_client(service_name, **kwargs):
        if service_name == "ssm":
            return mock_ssm
        if service_name == "s3":
            return mock_s3
        if service_name == "dynamodb":
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
        patch("boto3.resource", return_value=MagicMock()),
    ):
        # Re-import helpers so they pick up the mocked boto3
        for mod_name in _BOTO3_HELPER_MODULES:
            importlib.import_module(mod_name)

        # Now import the handler — module-level init will use mocked clients
        mod = importlib.import_module(_HANDLER_MODULE)

        # Replace the module-level appconfig_client with our mock
        mod.appconfig_client = mock_appconfig_client

    mod._mock_appconfig_client = mock_appconfig_client

    yield mod

    # Cleanup
    sys.modules.pop(_HANDLER_MODULE, None)


class TestMetaclassHandlerAppConfigIntegration:
    """Test metaclass handler uses AppConfig values when available (Req 4.5)."""

    def test_handler_uses_appconfig_model_id_and_temperature(self, handler_module):
        """When AppConfig returns config, handler uses model_id and temperature from it."""
        from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigSettings

        appconfig_settings = AppConfigSettings(model_id="appconfig-model-id", temperature=0.7)
        handler_module._mock_appconfig_client.get_configuration.return_value = appconfig_settings

        mock_prediction = MagicMock()
        mock_prediction.model_dump_json.return_value = "{}"
        mock_prediction.model_dump.return_value = {
            "possible_categories": ["cat1"],
            "clean_title": None,
            "findings": None,
        }
        handler_module.metaclass_classifier.classify = MagicMock(return_value=mock_prediction)

        event = {
            "product": {"title": "Test Product", "description": "A test product description"},
            "demo": False,
        }

        handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("metaclassClassification")
        assert handler_module.metaclass_classifier.model_id == "appconfig-model-id"
        assert handler_module.metaclass_classifier.temperature == 0.7


class TestMetaclassHandlerAppConfigFallback:
    """Test metaclass handler falls back to env vars when AppConfig returns None (Req 4.6)."""

    def test_handler_falls_back_to_env_var_when_appconfig_returns_none(self, handler_module):
        """When AppConfig returns None, handler uses BEDROCK_MODEL_ID env var and temperature 0."""
        handler_module._mock_appconfig_client.get_configuration.return_value = None

        mock_prediction = MagicMock()
        mock_prediction.model_dump_json.return_value = "{}"
        mock_prediction.model_dump.return_value = {
            "possible_categories": ["cat1"],
            "clean_title": None,
            "findings": None,
        }
        handler_module.metaclass_classifier.classify = MagicMock(return_value=mock_prediction)

        event = {
            "product": {"title": "Test Product", "description": "A test product description"},
            "demo": False,
        }

        handler_module.handler(event, None)

        handler_module._mock_appconfig_client.get_configuration.assert_called_with("metaclassClassification")
        assert handler_module.metaclass_classifier.model_id == "env-var-model-id"
        assert handler_module.metaclass_classifier.temperature == 0
