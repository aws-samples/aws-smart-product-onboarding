# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import re

import pytest
from amzn_smart_product_onboarding_core_utils.exceptions import (
    ContentFilteredError,
    ModelResponseError,
    RateLimitError,
    RetryableError,
)
from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_product_categorization import structured_output
from amzn_smart_product_onboarding_product_categorization.structured_output import (
    get_structured_output,
    output_model,
    safe_keys,
)

SAFE_KEY = re.compile(r"^[a-zA-Z0-9_.-]{1,64}$")
SCHEMA = {
    "type": "object",
    "properties": {"Type of Material": {"enum": ["PLASTIC", None]}, "Größe": {"type": ["string", "null"]}},
    "required": ["Type of Material", "Größe"],
    "additionalProperties": False,
}
CLAUDE = "global.anthropic.claude-sonnet-5-5"
NOVA = "global.amazon.nova-2-lite-v1:0"


def _text(values, stop_reason="end_turn"):
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": json.dumps(values)}]}},
        "stopReason": stop_reason,
        "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
    }


def _tool_use(values):
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"toolUse": {"toolUseId": "t1", "name": "answer", "input": values}}],
            }
        },
        "stopReason": "tool_use",
        "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
    }


def _ask(client, model_id=CLAUDE, schema=SCHEMA):
    return get_structured_output(client, model_id, "system", "prompt", schema, "answer")


# Name mapping


@pytest.mark.parametrize(
    "names, expected",
    [
        (["Type of Material"], ["Type_of_Material"]),
        (["explanation", "predicted_category_id"], ["explanation", "predicted_category_id"]),
        (["Größe", "Café Type", "日本語"], ["Groe", "Cafe_Type", "field"]),
        (["If Stretch", "If-Stretch", "If  Stretch"], ["If_Stretch", "If_Stretch_2", "If_Stretch_3"]),
        (["Type of Toy - Ride-on (Non Powered)"], ["Type_of_Toy_Ride_on_Non_Powered"]),
    ],
    ids=["spaces", "already safe", "unicode", "collisions", "punctuation"],
)
def test_safe_keys_are_readable_and_unique(names, expected):
    assert list(safe_keys(names).values()) == expected


def test_safe_keys_for_long_names_fit_bedrocks_pattern_and_stay_unique():
    names = ["A" * 80, "A" * 70, "A" * 64 + " B"]

    keys = list(safe_keys(names).values())

    assert all(SAFE_KEY.match(key) for key in keys)
    assert len(set(keys)) == 3
    assert keys == ["A" * 64, "A" * 62 + "_2", "A" * 62 + "_3"]


def test_safe_keys_are_the_same_on_every_call():
    names = ["Type of Material", "Type-of-Material", "Größe"]

    assert safe_keys(names) == safe_keys(list(names))


def test_output_model_keeps_order_enums_required_and_the_original_names():
    schema = {
        "type": "object",
        "properties": {
            "explanation": {"type": "string"},
            "Type of Material": {"enum": ["PLASTIC", None]},
            "Größe": {"type": ["string", "null"]},
        },
        "required": ["explanation", "Type of Material", "Größe"],
        "additionalProperties": False,
    }

    model_schema = output_model(schema, "answer", safe_keys(schema["properties"])).model_json_schema()

    assert list(model_schema["properties"]) == ["explanation", "Type_of_Material", "Groe"]
    assert model_schema["required"] == ["explanation", "Type_of_Material", "Groe"]
    assert model_schema["additionalProperties"] is False
    assert model_schema["properties"]["Type_of_Material"]["enum"] == ["PLASTIC", None]
    assert model_schema["properties"]["Type_of_Material"]["title"] == "Type of Material"
    assert model_schema["properties"]["Groe"]["description"] == "Größe"


def test_the_answer_comes_back_under_the_original_names(mock_bedrock):
    mock_bedrock.converse.return_value = _text({"Type_of_Material": "PLASTIC", "Groe": None})

    assert _ask(mock_bedrock) == {"Type of Material": "PLASTIC", "Größe": None}


# Request


def test_claude_gets_json_schema_output_on_converse_without_temperature(mock_bedrock):
    mock_bedrock.converse.return_value = _text({"Type_of_Material": None, "Groe": None})

    _ask(mock_bedrock)

    request = mock_bedrock.converse.call_args.kwargs
    schema = json.loads(request["outputConfig"]["textFormat"]["structure"]["jsonSchema"]["schema"])
    # Bedrock gets the nullable enum without a type, so it doesn't count as a union-typed property.
    assert schema["properties"]["Type_of_Material"]["enum"] == ["PLASTIC", None]
    assert "type" not in schema["properties"]["Type_of_Material"]
    assert schema["required"] == ["Type_of_Material", "Groe"] and schema["additionalProperties"] is False
    assert request["inferenceConfig"] == {"maxTokens": 4096}
    # Strands streams by default, which the Step Functions task roles don't allow.
    mock_bedrock.converse_stream.assert_not_called()


def test_nova_gets_a_forced_tool_on_converse_with_temperature(mock_bedrock):
    mock_bedrock.converse.return_value = _tool_use({"Type_of_Material": "PLASTIC", "Groe": "XL"})

    assert _ask(mock_bedrock, NOVA) == {"Type of Material": "PLASTIC", "Größe": "XL"}

    request = mock_bedrock.converse.call_args.kwargs
    assert "outputConfig" not in request
    assert request["toolConfig"]["toolChoice"] == {"any": {}}
    properties = request["toolConfig"]["tools"][0]["toolSpec"]["inputSchema"]["json"]["properties"]
    assert all(SAFE_KEY.match(key) for key in properties)
    assert request["inferenceConfig"]["temperature"] == 0
    mock_bedrock.converse_stream.assert_not_called()


# Validation


@pytest.mark.parametrize("model_id", [CLAUDE, NOVA])
def test_an_answer_outside_the_schema_is_retried_once(mock_bedrock, model_id):
    reply = _text if model_id == CLAUDE else _tool_use
    mock_bedrock.converse.side_effect = [
        reply({"Type_of_Material": "WOOD", "Groe": None}),
        reply({"Type_of_Material": "PLASTIC", "Groe": None}),
    ]

    assert _ask(mock_bedrock, model_id) == {"Type of Material": "PLASTIC", "Größe": None}
    retry = mock_bedrock.converse.call_args_list[1].kwargs["messages"][-1]["content"][0]["text"]
    assert "Your previous answer was rejected" in retry


def test_a_schema_keyword_the_output_model_cant_enforce_is_refused(mock_bedrock):
    # The output model is the only check on the answer, so it must not be looser than the schema.
    schema = {**SCHEMA, "properties": {**SCHEMA["properties"], "Größe": {"type": ["string", "null"], "maxLength": 2}}}

    with pytest.raises(ValueError, match="maxLength"):
        _ask(mock_bedrock, schema=schema)
    mock_bedrock.converse.assert_not_called()


@pytest.mark.parametrize(
    "answer",
    [{"Type_of_Material": "WOOD", "Groe": None}, {"Type_of_Material": None, "Groe": None, "Extra": 1}, {}],
    ids=["enum", "extra key", "missing keys"],
)
def test_a_second_mismatch_is_a_model_response_error(mock_bedrock, answer):
    mock_bedrock.converse.return_value = _text(answer)

    with pytest.raises(ModelResponseError):
        _ask(mock_bedrock)
    assert mock_bedrock.converse.call_count == 2


def test_the_mismatch_log_leaves_the_value_out(mock_bedrock, monkeypatch):
    warnings = []
    monkeypatch.setattr(structured_output.logger, "warning", warnings.append)
    mock_bedrock.converse.side_effect = [
        _text({"Type_of_Material": "SELLER TEXT", "Groe": None}),
        _text({"Type_of_Material": None, "Groe": None}),
    ]

    _ask(mock_bedrock)

    assert "SELLER TEXT" not in str(warnings)
    assert warnings == [{"schema_mismatch": "answer", "attempt": 1, "errors": ["Type of Material: literal_error"]}]


# Errors


@pytest.mark.parametrize("stop_reason", ["content_filtered", "guardrail_intervened"])
@pytest.mark.parametrize("model_id", [CLAUDE, NOVA])
def test_a_content_filter_stop_is_a_content_filtered_error(mock_bedrock, stop_reason, model_id):
    mock_bedrock.converse.return_value = {
        "output": {"message": {"role": "assistant", "content": []}},
        "stopReason": stop_reason,
        "usage": {"inputTokens": 1, "outputTokens": 0, "totalTokens": 1},
    }

    with pytest.raises(ContentFilteredError) as error:
        _ask(mock_bedrock, model_id)
    assert error.value.__cause__ is None
    mock_bedrock.converse.assert_called_once()


def test_schema_too_complex_is_raised_before_strands_drops_the_schema(mock_bedrock):
    too_complex = ClientError(
        {
            "Error": {"Code": "ValidationException", "Message": "Schema is too complex for compilation."},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "Converse",
    )
    mock_bedrock.converse.side_effect = too_complex

    with pytest.raises(ClientError) as error:
        _ask(mock_bedrock)
    assert error.value is too_complex
    # Strands would otherwise retry with an optional tool and no schema.
    mock_bedrock.converse.assert_called_once()


def test_other_bedrock_errors_are_raised(mock_bedrock):
    mock_bedrock.converse.side_effect = ClientError(
        {"Error": {"Code": "ValidationException", "Message": "The provided model identifier is invalid."}}, "Converse"
    )

    with pytest.raises(ClientError, match="model identifier"):
        _ask(mock_bedrock)


@pytest.mark.parametrize(
    "code, raised",
    [
        ("ThrottlingException", RateLimitError),
        ("ModelTimeoutException", RetryableError),
        ("InternalServerException", RetryableError),
        ("ServiceUnavailableException", RetryableError),
    ],
)
def test_throttling_and_transient_errors_are_retryable(mock_bedrock, code, raised):
    mock_bedrock.converse.side_effect = ClientError({"Error": {"Code": code, "Message": "slow down"}}, "Converse")

    with pytest.raises(raised):
        _ask(mock_bedrock)
    mock_bedrock.converse.assert_called_once()


def test_the_mismatch_log_doesnt_name_an_extra_key(mock_bedrock, monkeypatch):
    # The key is the model's own text.
    warnings = []
    monkeypatch.setattr(structured_output.logger, "warning", warnings.append)
    mock_bedrock.converse.side_effect = [
        _text({"Type_of_Material": None, "Groe": None, "seller@example.com": 1}),
        _text({"Type_of_Material": None, "Groe": None}),
    ]

    _ask(mock_bedrock)

    assert warnings == [{"schema_mismatch": "answer", "attempt": 1, "errors": ["<extra key>: extra_forbidden"]}]


def test_strands_uses_the_callers_client_without_creating_its_own(mock_bedrock, monkeypatch):
    import boto3.session

    def no_new_clients(*args, **kwargs):
        raise AssertionError("a second Bedrock client was created")

    monkeypatch.setattr(boto3.session.Session, "client", no_new_clients)
    mock_bedrock.converse.return_value = _text({"Type_of_Material": None, "Groe": None})

    assert _ask(mock_bedrock) == {"Type of Material": None, "Größe": None}
