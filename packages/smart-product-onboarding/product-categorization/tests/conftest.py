# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from unittest.mock import Mock

import boto3
import pytest

from amzn_smart_product_onboarding_core_utils.models import (
    Product,
    CategorizationPrediction,
)


@pytest.fixture
def mock_bedrock():
    # A real client, so Strands can read the Converse service model; only the call itself is stubbed.
    client = boto3.client("bedrock-runtime", region_name="us-east-1", aws_access_key_id="x", aws_secret_access_key="x")
    client.converse = Mock()
    client.converse_stream = Mock(side_effect=AssertionError("ConverseStream is not allowed"))
    return client


@pytest.fixture
def product(faker):
    return Product(title=faker.word(), description=faker.text())


@pytest.fixture
def product_with_metadata(product, faker):
    return product.model_copy(update={"metadata": faker.text()})


@pytest.fixture
def predicted_category(faker):
    return CategorizationPrediction(
        predicted_category_id=faker.word(),
        predicted_category_name=faker.word(),
        explanation=faker.text(),
    )
