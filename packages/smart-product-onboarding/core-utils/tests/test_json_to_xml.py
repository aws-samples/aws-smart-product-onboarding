# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest

from amzn_smart_product_onboarding_core_utils.json_to_xml import json_to_xml


@pytest.fixture
def shallow_json():
    return {"foo": "bar"}


@pytest.fixture
def nested_json():
    return {"foo": {"bar": {"fizz": "buzz"}}}


@pytest.fixture
def with_list():
    return {"foo": ["fizz", "buzz"]}


def test_it_can_create_shallow_xml(shallow_json):
    # when
    xml = json_to_xml(shallow_json)

    # then
    assert (
        xml
        == """<foo>
  bar
</foo>"""
    )


def test_it_can_create_nested_xml(nested_json):
    # when
    xml = json_to_xml(nested_json)

    # then
    assert (
        xml
        == """<foo>
  <bar>
    <fizz>
      buzz
    </fizz>
  </bar>
</foo>"""
    )


def test_it_can_create_with_list(with_list):
    # when
    xml = json_to_xml(with_list)

    # then
    assert (
        xml
        == """<foo>
  fizz
  buzz
</foo>"""
    )
