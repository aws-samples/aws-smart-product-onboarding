# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from pydantic import BaseModel

from amzn_smart_product_onboarding_core_utils.models import create_typed_dict_from_model


class MyModel(BaseModel):
    foo: str
    bar: list[str]


def test_it_can_convert_model_to_dict():
    MyModelDict = create_typed_dict_from_model(MyModel)

    expected_keys = set(MyModel.__annotations__.keys())
    result_keys = set(MyModelDict.__annotations__.keys())
    assert expected_keys == result_keys
