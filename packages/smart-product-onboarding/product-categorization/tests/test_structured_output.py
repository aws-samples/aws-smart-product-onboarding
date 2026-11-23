# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest
from botocore.exceptions import ClientError
from pydantic_ai import Agent
from pydantic_ai.exceptions import ContentFilterError

from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError
from amzn_smart_product_onboarding_product_categorization.structured_output import get_structured_output

SCHEMA = {
    "type": "object",
    "properties": {"a": {"enum": ["x", None]}},
    "required": ["a"],
    "additionalProperties": False,
}


def _ask(client, model_id="global.anthropic.claude-sonnet-5-5"):
    return get_structured_output(client, model_id, "system", "prompt", SCHEMA, "answer")


def test_pydantic_ai_content_filter_error_is_a_content_filtered_error(mock_bedrock, monkeypatch):
    def blocked(self, *args, **kwargs):
        raise ContentFilterError("Content filter triggered", body='{"text": "seller data"}')

    monkeypatch.setattr(Agent, "run_sync", blocked)

    with pytest.raises(ContentFilteredError) as error:
        _ask(mock_bedrock)
    # Not chained, so a logged traceback doesn't carry the response body.
    assert error.value.__cause__ is None and error.value.__suppress_context__


def test_bedrock_validation_exception_is_raised_unchanged(mock_bedrock):
    rejected = ClientError(
        {
            "Error": {"Code": "ValidationException", "Message": "Schema is too complex for compilation."},
            "ResponseMetadata": {"HTTPStatusCode": 400},
        },
        "Converse",
    )
    mock_bedrock.converse.side_effect = rejected

    with pytest.raises(ClientError) as error:
        _ask(mock_bedrock)
    assert error.value is rejected


def test_request_uses_converse_with_a_token_limit(mock_bedrock):
    # Without maxTokens, Pydantic AI streams with ConverseStream, which the task roles don't allow.
    mock_bedrock.converse.return_value = {
        "output": {"message": {"role": "assistant", "content": [{"text": '{"a": "x"}'}]}},
        "stopReason": "end_turn",
        "usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2},
    }

    assert _ask(mock_bedrock) == {"a": "x"}
    assert mock_bedrock.converse.call_args.kwargs["inferenceConfig"] == {"maxTokens": 4096}


@pytest.mark.parametrize(
    "model_id, sends_temperature",
    [
        ("global.anthropic.claude-sonnet-5-5", False),
        ("global.anthropic.claude-haiku-5-5", False),
        ("global.amazon.nova-2-lite-v1:0", True),
    ],
)
def test_temperature_is_only_set_for_models_that_take_it(mock_bedrock, monkeypatch, model_id, sends_temperature):
    # Pydantic AI would also drop it for Claude 5.5, with a warning; the helper doesn't ask for it.
    settings = {}

    def capture(self, prompt, model_settings):
        settings.update(model_settings)
        raise ContentFilterError("stop here")

    monkeypatch.setattr(Agent, "run_sync", capture)

    with pytest.raises(ContentFilteredError):
        _ask(mock_bedrock, model_id)
    assert ("temperature" in settings) is sends_temperature
