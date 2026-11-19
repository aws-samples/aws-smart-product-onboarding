# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from amzn_smart_product_onboarding_api_common.handler import Response
from amzn_smart_product_onboarding_api_common.models import MetaclassResponseContent


def test_response():
    response = Response.success(MetaclassResponseContent(possibleCategories=["1", "2", "3"]))
    assert response.status_code == 200
    assert response.body.possible_categories == ["1", "2", "3"]
