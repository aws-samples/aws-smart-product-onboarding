# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import logging

from amzn_smart_product_onboarding_core_utils.json_output import find_json


def test_only_json():
    input = """
    {
        "a": 1,
        "b": 2
    }
    """
    expected = {"a": 1, "b": 2}
    output = find_json(input)
    assert output == expected


def test_missing_final_bracket():
    input = """
    {
        "a": 1,
        "b": 2
    """
    expected = {"a": 1, "b": 2}
    output = find_json(input)
    assert output == expected


def test_llm_preamble_response():
    input = """This your output in JSON format:
    
    {
        "a": 1,
        "b": 2
    }
    """
    expected = {"a": 1, "b": 2}
    output = find_json(input)
    assert output == expected


def test_multiple_json_objects(caplog):
    caplog.set_level(logging.INFO)
    input = """
    {
        "a": 1,
        "b": 2
    }
    {
        "c": 3,
        "d": 4
    }
    """
    expected = None
    output = find_json(input)
    assert output == expected
    assert "Failed to parse JSON: " in caplog.text


def test_nested_json_objects():
    input = """
    {
        "a": 1,
        "b": {
            "c": 2,
            "d": 3
        }
    }
    """
    expected = {"a": 1, "b": {"c": 2, "d": 3}}
    output = find_json(input)
    assert output == expected


def test_no_json(caplog):
    caplog.set_level(logging.INFO)
    input = """
    This is a regular string.
    """
    expected = None
    output = find_json(input)
    assert output == expected
    assert "Failed to parse JSON: " in caplog.text
