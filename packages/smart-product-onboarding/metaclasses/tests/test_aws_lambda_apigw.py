# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from amzn_smart_product_onboarding_api_python_runtime import MetaclassResponseContent
from amzn_smart_product_onboarding_api_python_runtime.response import Response


def test_response():
    response = Response.success(
        MetaclassResponseContent(possibleCategories=["1", "2", "3"])
    )
    assert response.status_code == 200
    assert response.body.possible_categories == ["1", "2", "3"]
