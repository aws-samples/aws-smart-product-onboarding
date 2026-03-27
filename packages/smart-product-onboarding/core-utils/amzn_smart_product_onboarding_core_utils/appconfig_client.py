# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
AppConfig client for retrieving runtime AI model configuration.

Uses the AppConfigData service (start_configuration_session / get_latest_configuration)
with token-based polling.  Never raises — all errors are caught internally and
logged, returning ``None`` so callers can fall back to defaults.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import boto3

logger = logging.getLogger(__name__)


@dataclass
class AppConfigSettings:
    """Runtime model settings retrieved from AppConfig."""

    model_id: str
    temperature: float


class AppConfigClient:
    """Thin wrapper around the ``appconfigdata`` boto3 client.

    Maintains a session token across invocations so that AppConfig only
    returns new data when the configuration has actually changed.
    """

    def __init__(
        self,
        application_id: str,
        environment_id: str,
        configuration_profile_id: str,
    ) -> None:
        self._application_id = application_id
        self._environment_id = environment_id
        self._configuration_profile_id = configuration_profile_id
        self._client = boto3.client("appconfigdata")
        self._session_token: str | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_configuration(self, component_key: str) -> AppConfigSettings | None:
        """Return settings for *component_key*, or ``None`` on any failure."""
        try:
            if self._session_token is None:
                self._start_session()

            response = self._client.get_latest_configuration(
                ConfigurationToken=self._session_token,
            )

            # Advance the token for the next poll.
            self._session_token = response.get("NextPollConfigurationToken")

            # An empty body means nothing has changed (or nothing deployed yet).
            content: bytes = response["Configuration"].read()
            if not content:
                logger.info("AppConfig returned empty configuration body")
                return None

            config_document = json.loads(content)
            component_config = config_document.get(component_key)
            if component_config is None:
                logger.warning(
                    "Missing component key '%s' in AppConfig configuration",
                    component_key,
                )
                return None

            return AppConfigSettings(
                model_id=component_config["modelId"],
                temperature=component_config["temperature"],
            )
        except Exception:
            logger.warning(
                "Failed to retrieve AppConfig configuration",
                exc_info=True,
            )
            # Reset so the next call starts a fresh session.
            self._session_token = None
            return None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _start_session(self) -> None:
        response = self._client.start_configuration_session(
            ApplicationIdentifier=self._application_id,
            EnvironmentIdentifier=self._environment_id,
            ConfigurationProfileIdentifier=self._configuration_profile_id,
        )
        self._session_token = response["InitialConfigurationToken"]
