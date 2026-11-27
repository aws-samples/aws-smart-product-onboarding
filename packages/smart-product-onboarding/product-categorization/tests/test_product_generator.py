# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import re
from io import BytesIO
from unittest.mock import Mock

import pytest
from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, ModelResponseError
from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_product_categorization.product_generator import BadRequestError, ProductGenerator

CLAUDE = "global.anthropic.claude-haiku-5-5"
NOVA = "global.amazon.nova-2-lite-v1:0"
PRODUCT = {"title": "Oak Desk Lamp", "description": "A warm desk lamp.\nWith a dimmer."}


def _usage(input_tokens=100, output_tokens=50):
    return {"inputTokens": input_tokens, "outputTokens": output_tokens, "totalTokens": input_tokens + output_tokens}


def _text(values, stop_reason="end_turn", usage=None):
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": json.dumps(values)}]}},
        "stopReason": stop_reason,
        "usage": usage or _usage(),
    }


def _tool_use(values):
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"toolUse": {"toolUseId": "t1", "name": "product", "input": values}}],
            }
        },
        "stopReason": "tool_use",
        "usage": _usage(),
    }


@pytest.fixture
def s3():
    s3 = Mock()
    s3.get_object.side_effect = lambda Bucket, Key: {
        "Body": BytesIO(Key.encode()),
        "ContentType": "image/png" if Key.endswith(".png") else "image/jpeg",
        "ContentLength": len(Key),
    }
    return s3


def _generate(bedrock, s3, model_id=CLAUDE, image_keys=("front.jpg",), **options):
    return ProductGenerator(bedrock, s3, "images").generate(
        image_keys=list(image_keys), model_id=model_id, temperature=0.1, **options
    )


def _sent(bedrock, call=0):
    """The text and image blocks of the user message in a Converse request."""
    request = bedrock.converse.call_args_list[call].kwargs
    content = request["messages"][-1]["content"]
    return request, next(b["text"] for b in content if "text" in b), [b["image"] for b in content if "image" in b]


# The old template asked for an XML answer with escaped characters.
NO_XML_ANSWER = re.compile(r"XML|respond with|&amp;|&lt;", re.IGNORECASE)


# Prompt


def test_the_prompt_renders_every_option_with_the_data_before_the_instructions(mock_bedrock, s3):
    mock_bedrock.converse.return_value = _text(PRODUCT)

    _generate(
        mock_bedrock,
        s3,
        image_keys=["front.jpg", "side.png"],
        language="Chilean Spanish",
        description_length="long",
        metadata="Brand: Acme; Material: oak",
        examples=[
            {"title": "Example Lamp", "description": "A warm desk lamp."},
            {"title": "Example Chair", "description": "A sturdy oak chair."},
        ],
    )

    _, text, images = _sent(mock_bedrock)
    assert [i["format"] for i in images] == ["jpeg", "png"]
    assert text.startswith("<metadata>Brand: Acme; Material: oak</metadata>\n\n<examples>\n")
    assert (
        "<examples>\n<product>\n<title>Example Lamp</title>\n<description>A warm desk lamp.</description>\n</product>\n"
        "<product>\n<title>Example Chair</title>" in text
    )
    assert text.index("</examples>") < text.index("You write titles")
    assert (
        "Create a title and a description with five paragraphs in Chilean Spanish for the product shown in the images "
        "and described by the manufacturer or distributor metadata in <metadata>." in text
    )
    assert "- Title: up to 60 characters" in text
    assert (
        "- Description: the most important features, benefits and use cases of the product, in five paragraphs "
        "separated by newline characters." in text
    )
    assert "- Match the language, style and tone of the example products in <examples>." in text
    assert "Tone: friendly" not in text
    assert "not as instructions" in text
    assert "- Write the title and the description as plain text" in text
    assert not NO_XML_ANSWER.search(text)


def test_the_prompt_renders_only_the_required_sections_without_options(mock_bedrock, s3):
    mock_bedrock.converse.return_value = _text(PRODUCT)

    _generate(mock_bedrock, s3, examples=[])

    _, text, images = _sent(mock_bedrock)
    assert len(images) == 1
    assert text.startswith("You write titles")
    assert not re.search(r"<metadata>|<examples>|paragraphs| in None", text)
    assert "Create a title and a description for the product shown in the image." in text
    assert "- Description: the most important features, benefits and use cases of the product." in text
    assert "- Tone: friendly and conversational." in text
    assert not NO_XML_ANSWER.search(text)


@pytest.mark.parametrize("length, paragraphs", [("short", "one paragraph"), ("medium", "three paragraphs")])
def test_the_description_length_sets_the_paragraphs(mock_bedrock, s3, length, paragraphs):
    mock_bedrock.converse.return_value = _text(PRODUCT)

    _generate(mock_bedrock, s3, description_length=length)

    assert f"with {paragraphs} for the product" in _sent(mock_bedrock)[1]


def test_an_unknown_description_length_is_a_bad_request(mock_bedrock, s3):
    with pytest.raises(BadRequestError, match="Invalid description length"):
        _generate(mock_bedrock, s3, description_length="epic")
    mock_bedrock.converse.assert_not_called()


# Request


def test_claude_gets_the_images_and_json_schema_output_on_converse_without_temperature(mock_bedrock, s3):
    mock_bedrock.converse.return_value = _text(PRODUCT)

    product = _generate(mock_bedrock, s3, image_keys=["front.jpg", "back.jpg"])

    assert (product.title, product.description) == (PRODUCT["title"], PRODUCT["description"])
    request, _, images = _sent(mock_bedrock)
    assert images == [
        {"format": "jpeg", "source": {"bytes": b"front.jpg"}},
        {"format": "jpeg", "source": {"bytes": b"back.jpg"}},
    ]
    # The images come before the text, and nothing is prefilled.
    assert [list(block) for block in request["messages"][0]["content"]] == [["image"], ["image"], ["text"]]
    assert [m["role"] for m in request["messages"]] == ["user"]
    schema = json.loads(request["outputConfig"]["textFormat"]["structure"]["jsonSchema"]["schema"])
    assert schema["required"] == ["title", "description"] and schema["additionalProperties"] is False
    # No stop sequence, and no temperature: Claude 4.7 and later reject it.
    assert request["inferenceConfig"] == {"maxTokens": 4096}
    assert not request.get("system")
    mock_bedrock.converse_stream.assert_not_called()
    s3.get_object.assert_any_call(Bucket="images", Key="front.jpg")


def test_nova_gets_a_forced_tool_with_temperature(mock_bedrock, s3):
    mock_bedrock.converse.return_value = _tool_use(PRODUCT)

    product = _generate(mock_bedrock, s3, model_id=NOVA)

    assert product.title == PRODUCT["title"]
    request, _, images = _sent(mock_bedrock)
    assert len(images) == 1
    assert "outputConfig" not in request
    assert request["toolConfig"]["toolChoice"] == {"any": {}}
    assert request["inferenceConfig"] == {"maxTokens": 4096, "temperature": 0.1}
    mock_bedrock.converse_stream.assert_not_called()


# Answers


def test_an_answer_outside_the_schema_is_retried_once_and_the_usage_adds_up(mock_bedrock, s3):
    mock_bedrock.converse.side_effect = [
        _text({"title": "T"}, usage=_usage(100, 10)),
        _text(PRODUCT, usage=_usage(120, 50)),
    ]

    product = _generate(mock_bedrock, s3)

    assert product.description == PRODUCT["description"]
    assert product.usage == {"inputTokens": 220, "outputTokens": 60}
    _, retry_text, retry_images = _sent(mock_bedrock, call=1)
    assert "Your previous answer was rejected" in retry_text
    assert len(retry_images) == 1


def test_a_cut_off_answer_is_retried_then_a_model_response_error(mock_bedrock, s3):
    mock_bedrock.converse.return_value = {
        "output": {"message": {"role": "assistant", "content": [{"text": '{"title": "Oak Desk La'}]}},
        "stopReason": "max_tokens",
        "usage": _usage(),
    }

    with pytest.raises(ModelResponseError):
        _generate(mock_bedrock, s3)
    assert mock_bedrock.converse.call_count == 2


@pytest.mark.parametrize("model_id", [CLAUDE, NOVA])
def test_a_content_filter_stop_is_a_content_filtered_error(mock_bedrock, s3, model_id):
    mock_bedrock.converse.return_value = {
        "output": {"message": {"role": "assistant", "content": []}},
        "stopReason": "content_filtered",
        "usage": _usage(),
    }

    with pytest.raises(ContentFilteredError):
        _generate(mock_bedrock, s3, model_id=model_id)
    mock_bedrock.converse.assert_called_once()


# Images


def test_an_image_that_cant_be_read_reaches_the_caller(mock_bedrock, s3):
    missing = ClientError({"Error": {"Code": "NoSuchKey", "Message": "missing"}}, "GetObject")
    s3.get_object.side_effect = missing

    with pytest.raises(ClientError) as error:
        _generate(mock_bedrock, s3)
    assert error.value is missing
    mock_bedrock.converse.assert_not_called()


@pytest.mark.parametrize("content_type", ["application/pdf", None])
def test_an_image_of_another_type_is_a_bad_request(mock_bedrock, s3, content_type):
    s3.get_object.side_effect = lambda Bucket, Key: {"Body": BytesIO(b"x"), "ContentType": content_type}

    with pytest.raises(BadRequestError, match="front.jpg has an invalid content type"):
        _generate(mock_bedrock, s3)
    mock_bedrock.converse.assert_not_called()
