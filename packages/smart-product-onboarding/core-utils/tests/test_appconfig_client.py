# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

"""Unit tests for the AppConfig configuration client.

Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
"""

import io
import json
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_core_utils.appconfig_client import (
    AppConfigClient,
    AppConfigSettings,
)

APP_ID = "test-app-id"
ENV_ID = "test-env-id"
PROFILE_ID = "test-profile-id"

VALID_CONFIG = {
    "productGeneration": {"modelId": "us.amazon.nova-lite-v1:0", "temperature": 0.1},
    "metaclassClassification": {"modelId": "us.amazon.nova-micro-v1:0", "temperature": 0},
    "productCategorization": {"modelId": "us.anthropic.claude-3-haiku-20240307-v1:0", "temperature": 0},
    "attributeExtraction": {"modelId": "us.amazon.nova-premier-v1:0", "temperature": 0},
}


def _make_stream(data: bytes) -> io.BytesIO:
    """Create a readable stream from bytes, mimicking the botocore StreamingBody."""
    return io.BytesIO(data)


@pytest.fixture
def mock_boto3_client():
    """Patch boto3.client to return a mock appconfigdata client."""
    with patch("amzn_smart_product_onboarding_core_utils.appconfig_client.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        yield mock_client


class TestSuccessfulRetrieval:
    """Validates Requirement 4.1, 4.2, 4.3: Successful configuration retrieval."""

    def test_returns_settings_for_valid_component_key(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("metaclassClassification")

        assert result is not None
        assert isinstance(result, AppConfigSettings)
        assert result.model_id == "us.amazon.nova-micro-v1:0"
        assert result.temperature == 0

    def test_returns_settings_for_each_component_key(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }

        for key, expected in VALID_CONFIG.items():
            mock_boto3_client.get_latest_configuration.return_value = {
                "NextPollConfigurationToken": "next-token",
                "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
            }
            # Reset session token to force a new session each iteration
            client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
            result = client.get_configuration(key)

            assert result is not None
            assert result.model_id == expected["modelId"]
            assert result.temperature == expected["temperature"]

    def test_starts_session_with_correct_parameters(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        client.get_configuration("productGeneration")

        mock_boto3_client.start_configuration_session.assert_called_once_with(
            ApplicationIdentifier=APP_ID,
            EnvironmentIdentifier=ENV_ID,
            ConfigurationProfileIdentifier=PROFILE_ID,
        )


class TestSessionTokenReuse:
    """Validates Requirement 4.4: Session token caching/reuse across invocations."""

    def test_reuses_session_token_on_subsequent_calls(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "second-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)

        # First call — starts session
        client.get_configuration("productGeneration")
        assert mock_boto3_client.start_configuration_session.call_count == 1
        mock_boto3_client.get_latest_configuration.assert_called_with(ConfigurationToken="initial-token")

        # Second call — reuses the NextPollConfigurationToken
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "third-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }
        client.get_configuration("productGeneration")

        # Session should NOT be started again
        assert mock_boto3_client.start_configuration_session.call_count == 1
        mock_boto3_client.get_latest_configuration.assert_called_with(ConfigurationToken="second-token")


class TestEmptyBody:
    """Validates Requirement 4.6: Returns None when no configuration is deployed."""

    def test_returns_none_on_empty_configuration_body(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(b""),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("productGeneration")

        assert result is None


class TestNetworkError:
    """Validates Requirement 4.6: Returns None and resets session on network errors."""

    def test_returns_none_on_start_session_error(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "Service unavailable"}},
            "StartConfigurationSession",
        )

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("productGeneration")

        assert result is None

    def test_returns_none_on_get_latest_configuration_error(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "Service unavailable"}},
            "GetLatestConfiguration",
        )

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("productGeneration")

        assert result is None

    def test_resets_session_token_after_error(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        # First call fails
        mock_boto3_client.get_latest_configuration.side_effect = ClientError(
            {"Error": {"Code": "InternalServerError", "Message": "boom"}},
            "GetLatestConfiguration",
        )

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("productGeneration")
        assert result is None

        # Second call should start a new session (token was reset)
        mock_boto3_client.get_latest_configuration.side_effect = None
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "new-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }
        result = client.get_configuration("productGeneration")

        assert result is not None
        assert mock_boto3_client.start_configuration_session.call_count == 2


class TestMalformedJSON:
    """Validates Requirement 4.6: Returns None on malformed JSON response."""

    def test_returns_none_on_invalid_json(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(b"not valid json {{{"),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("productGeneration")

        assert result is None


class TestMissingComponentKey:
    """Validates Requirement 4.6: Returns None when requested component key is absent."""

    def test_returns_none_for_missing_key(self, mock_boto3_client):
        config_without_key = {"productGeneration": {"modelId": "m", "temperature": 0.5}}
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(json.dumps(config_without_key).encode()),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("attributeExtraction")

        assert result is None

    def test_returns_none_for_completely_unknown_key(self, mock_boto3_client):
        mock_boto3_client.start_configuration_session.return_value = {
            "InitialConfigurationToken": "initial-token",
        }
        mock_boto3_client.get_latest_configuration.return_value = {
            "NextPollConfigurationToken": "next-token",
            "Configuration": _make_stream(json.dumps(VALID_CONFIG).encode()),
        }

        client = AppConfigClient(APP_ID, ENV_ID, PROFILE_ID)
        result = client.get_configuration("nonExistentComponent")

        assert result is None
