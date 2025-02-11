# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from unittest.mock import Mock

import pytest

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    BedrockRuntimeClient,
)
from amzn_smart_product_onboarding_core_utils.models import (
    Product,
    CategorizationPrediction,
)


@pytest.fixture
def mock_bedrock():
    mock = Mock(spec=BedrockRuntimeClient)
    mock.converse = Mock()
    return mock


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
