# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Tests for attribute extraction handler AppConfig integration.

Validates:
- Requirements 4.5: Handler uses AppConfig model_id and temperature when available
- Requirements 4.6: Handler falls back to env vars when AppConfig returns None
"""

import importlib
import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

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

_HANDLER_MODULE = "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction"


@pytest.fixture(params=[{"attributesSchema": "data/abc/linted_attrs.json"}, {}, None])
def handler_module(request):
    """Import the attribute extraction handler module with all heavy dependencies mocked.

    The param is the CategorizationConfig value, or None when the parameter doesn't exist yet
    (only notebook 1 has run, which uploads the schema to the fixed key).
    """
    for mod_name in [_HANDLER_MODULE, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(mod_name, None)

    mock_s3_resource = MagicMock()
    mock_appconfig_client = MagicMock()
    mock_ssm = MagicMock()
    if request.param is None:
        mock_ssm.get_parameter.side_effect = ClientError({"Error": {"Code": "ParameterNotFound"}}, "GetParameter")
    else:
        mock_ssm.get_parameter.return_value = {"Parameter": {"Value": json.dumps(request.param)}}

    def _fake_boto3_client(service_name, **kwargs):
        if service_name == "ssm":
            return mock_ssm
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
    mod._config_paths = request.param

    yield mod

    sys.modules.pop(_HANDLER_MODULE, None)


def test_schema_is_read_from_the_categorization_config(handler_module):
    """The schema key comes from the same configuration as the category tree, or the fixed key without one."""
    mock_ssm = handler_module.LAMBDA_SSM_CLIENT
    mock_ssm.get_parameter.assert_called_once_with(Name="/test/config-paths")
    expected = (handler_module._config_paths or {}).get("attributesSchema", "data/attributes_schema.json")
    with (
        patch.object(handler_module, "GPCSchemaRetriever") as retriever,
        patch.object(handler_module, "AttributesExtractor"),
    ):
        handler_module._mock_appconfig_client.get_configuration.return_value = None
        handler_module.handler(
            {
                "product": {"title": "Test Product", "description": "A test product description"},
                "category": {"predicted_category_id": "123", "predicted_category_name": "x", "explanation": "x"},
            },
            None,
        )
    assert retriever.call_args.kwargs["schema_path"] == expected


@pytest.mark.parametrize(
    "module_name",
    [_HANDLER_MODULE, "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction_apigw"],
)
@pytest.mark.parametrize("code", ["ParameterNotFound", "AccessDeniedException"])
def test_missing_parameter_uses_the_fixed_key_and_other_ssm_errors_fail(module_name, code):
    """Only a missing parameter falls back to the fixed key; a denied read is not hidden."""
    for mod_name in [module_name, *_BOTO3_HELPER_MODULES]:
        sys.modules.pop(mod_name, None)
    mock_ssm = MagicMock()
    mock_ssm.get_parameter.side_effect = ClientError({"Error": {"Code": code}}, "GetParameter")
    try:
        with (
            patch.dict(os.environ, _ENV),
            patch("boto3.client", side_effect=lambda name, **kw: mock_ssm if name == "ssm" else MagicMock()),
            patch("boto3.resource", return_value=MagicMock()),
        ):
            for mod_name in _BOTO3_HELPER_MODULES:
                importlib.import_module(mod_name)
            if code == "ParameterNotFound":
                assert importlib.import_module(module_name).SCHEMA_PATH == "data/attributes_schema.json"
            else:
                with pytest.raises(ClientError, match="AccessDenied"):
                    importlib.import_module(module_name)
    finally:
        sys.modules.pop(module_name, None)


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
