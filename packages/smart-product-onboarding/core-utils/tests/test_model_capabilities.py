# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest

from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    complete_response,
    ensure_cross_region_profile,
    prepare_converse_request,
    supports_prefill,
    supports_temperature,
)

USER = [{"role": "user", "content": [{"text": "hi"}]}]


@pytest.mark.parametrize(
    "model_id, prefill, temperature",
    [
        ("us.amazon.nova-micro-v1:0", True, True),
        ("global.amazon.nova-2-lite-v1:0", True, True),
        ("anthropic.claude-3-haiku-20240307-v1:0", True, True),
        ("global.anthropic.claude-haiku-4-5-20251001-v1:0", True, True),
        ("global.anthropic.claude-sonnet-4-20250514-v1:0", True, True),
        ("global.anthropic.claude-sonnet-4-6", False, True),
        ("global.anthropic.claude-opus-4-6-v1", False, True),
        ("global.anthropic.claude-opus-4-7", False, False),
        ("global.anthropic.claude-haiku-5-5", False, False),
        ("global.anthropic.claude-sonnet-5-5", False, False),
        ("global.anthropic.claude-fable-5", False, False),
    ],
)
def test_capabilities(model_id, prefill, temperature):
    assert supports_prefill(model_id) is prefill
    assert supports_temperature(model_id) is temperature


def test_prepare_request_with_prefill_and_temperature():
    messages, config = prepare_converse_request("us.amazon.nova-micro-v1:0", USER, "<r>", "</r>", 0.3)
    assert messages == USER + [{"role": "assistant", "content": [{"text": "<r>"}]}]
    assert config == {"stopSequences": ["</r>"], "temperature": 0.3}


def test_prepare_request_without_prefill_or_temperature():
    messages, config = prepare_converse_request("global.anthropic.claude-haiku-5-5", USER, "<r>", "</r>", 0.3)
    assert messages == USER
    assert config == {"stopSequences": ["</r>"]}


def test_prepare_request_does_not_mutate_input():
    original = list(USER)
    prepare_converse_request("us.amazon.nova-micro-v1:0", original, "<r>", "</r>")
    assert original == USER


def test_complete_response_with_prefill():
    assert complete_response("body", "stop_sequence", "us.amazon.nova-micro-v1:0", "<r>", "</r>") == "<r>body</r>"
    assert complete_response("body</r>", "end_turn", "us.amazon.nova-micro-v1:0", "<r>", "</r>") == "<r>body</r>"
    assert complete_response("body", "max_tokens", "us.amazon.nova-micro-v1:0", "<r>", "</r>") is None


def test_complete_response_without_prefill_drops_preamble():
    model = "global.anthropic.claude-haiku-5-5"
    text = "Here is my answer:\n<response>\n<thinking>t</thinking><prediction/>"
    assert complete_response(text, "stop_sequence", model, "<response>\n<thinking>", "</response>") == (
        "<response>\n<thinking>t</thinking><prediction/></response>"
    )


def test_complete_response_without_prefill_json():
    model = "global.anthropic.claude-sonnet-5-5"
    text = '```json\n{"normalized_title": "led bulb'
    assert complete_response(text, "stop_sequence", model, '{"normalized_title": "', '"}') == (
        '{"normalized_title": "led bulb"}'
    )


def test_complete_response_without_prefill_missing_opening():
    assert complete_response("no tags", "stop_sequence", "global.anthropic.claude-haiku-5-5", "<r>", "</r>") is None


@pytest.mark.parametrize(
    "model_id, expected",
    [
        ("anthropic.claude-haiku-4-5-20251001-v1:0", "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
        ("us.amazon.nova-micro-v1:0", "us.amazon.nova-micro-v1:0"),
        ("global.anthropic.claude-haiku-5-5", "global.anthropic.claude-haiku-5-5"),
        ("eu.amazon.nova-lite-v1:0", "eu.amazon.nova-lite-v1:0"),
    ],
)
def test_ensure_cross_region_profile(model_id, expected):
    assert ensure_cross_region_profile(model_id) == expected
