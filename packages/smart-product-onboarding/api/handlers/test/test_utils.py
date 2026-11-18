# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from unittest.mock import patch

import pytest

from amzn_smart_product_onboarding_api_python_handlers import utils

GETTERS = [
    utils.get_s3_client,
    utils.get_sfn_client,
    utils.get_dynamodb_client,
    utils.get_dynamodb_resource,
]


def _clear_all():
    for getter in GETTERS:
        getter.cache_clear()


@pytest.fixture(autouse=True)
def clear_client_cache(monkeypatch):
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    _clear_all()
    yield
    _clear_all()


@pytest.mark.parametrize("getter", GETTERS, ids=lambda g: g.__name__)
def test_second_call_reuses_client(getter):
    with patch.object(utils, "Session", wraps=utils.Session) as session:
        first = getter()
        second = getter()

    assert first is second
    assert session.call_count == 1


def test_s3_client_keeps_config():
    client = utils.get_s3_client()

    assert client.meta.config.signature_version == "s3v4"
    assert client.meta.config.s3["addressing_style"] == "virtual"


def test_cache_clear_creates_new_client():
    first = utils.get_s3_client()
    utils.get_s3_client.cache_clear()

    assert utils.get_s3_client() is not first
