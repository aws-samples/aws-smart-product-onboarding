# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
import pytest
import random
from unittest.mock import Mock, ANY

from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, ModelResponseError
from amzn_smart_product_onboarding_core_utils.models import Product
from amzn_smart_product_onboarding_product_categorization import attributes_extractor
from amzn_smart_product_onboarding_product_categorization.structured_output import safe_keys
from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    AttributesExtractor,
    SchemaRetriever,
    CategorySchema,
    GPCSchemaRetriever,
    CategorySchemaNotFound,
)


@pytest.fixture(autouse=True)
def no_cached_fallback_categories():
    attributes_extractor._CATEGORIES_NEEDING_STRING_SCHEMA.clear()
    yield
    attributes_extractor._CATEGORIES_NEEDING_STRING_SCHEMA.clear()


@pytest.fixture
def category_schema(faker):
    return CategorySchema(
        category_name=faker.word(),
        subcategory_name=faker.word(),
        attributes_schema=[
            {
                "Title": "Type of Material",
                "Definition": "Indicates, with reference to the product branding, labelling or packaging, the descriptive term that is used by the product manufacturer to identify the type of material from which the product is made.",
                "Childs": [
                    {
                        "Title": "PLASTIC",
                        "Definition": "Plastic is a material consisting of any of a wide range of synthetic or semi-synthetic organics that are malleable and can be molded into solid objects of diverse shapes. Plastics are typically organic polymers of high molecular mass, but they often contain other substances. They are usually synthetic, most commonly derived from petrochemicals, but many are partially natural. Plasticity is the general property of all materials that are able to irreversibly deform without breaking, but this occurs to such a degree with this class of moldable polymers that their name is an emphasis on this ability.",
                        "Childs": [],
                    },
                    {
                        "Title": "UNCLASSIFIED",
                        "Definition": "This term is used to describe those product attributes that are unable to be classified within their specific market; e.g. goat's cheese - goat's cheeses is often generically labelled and cannot be further classified.",
                        "Childs": [],
                    },
                    {
                        "Title": "UNIDENTIFIED",
                        "Definition": "This term is used to describe those product attributes that are unidentifiable given existing or available product information.",
                        "Childs": [],
                    },
                ],
            }
        ],
    )


def _wire(values):
    """The model answers with the safe keys the request used."""
    return {safe_keys([name])[name]: value for name, value in values.items()}


def _a_response_from_bedrock(values, stop_reason="end_turn"):
    text = values if isinstance(values, str) else json.dumps(_wire(values))
    return {
        "output": {"message": {"role": "assistant", "content": [{"text": text}]}},
        "stopReason": stop_reason,
        "usage": {"inputTokens": 100, "outputTokens": 50},
    }


@pytest.fixture
def schema_retriever(category_schema):
    schema_retriever = Mock(spec_set=SchemaRetriever)
    schema_retriever.get.return_value = category_schema
    return schema_retriever


@pytest.fixture
def extractor(mock_bedrock, schema_retriever):
    return AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)


def _schema_sent(call):
    return json.loads(call.kwargs["outputConfig"]["textFormat"]["structure"]["jsonSchema"]["schema"])


def _property_sent(call, name):
    return _schema_sent(call)["properties"][safe_keys([name])[name]]


def _too_complex():
    return ClientError(
        {
            "Error": {
                "Code": "ValidationException",
                "Message": "The model returned the following errors: compilation exceeded limits: "
                "Schema is too complex for compilation.",
            }
        },
        "Converse",
    )


def test_attributes_extractor_when_category_is_found(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": "PLASTIC"})

    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "PLASTIC"}]


def test_null_value_is_returned_as_the_null_string(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": None})

    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "null"}]


def test_schema_requires_every_attribute_with_its_listed_values_or_null(
    mock_bedrock, extractor, product, predicted_category
):
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": None})

    extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    call = mock_bedrock.converse.call_args
    assert call.kwargs["outputConfig"]["textFormat"]["type"] == "json_schema"
    schema = _schema_sent(call)
    assert schema["properties"] == {
        "Type_of_Material": {
            "enum": ["PLASTIC", "UNCLASSIFIED", "UNIDENTIFIED", None],
            "title": "Type of Material",
            "description": "Type of Material",
        }
    }
    assert schema["required"] == ["Type_of_Material"]
    assert schema["additionalProperties"] is False


def test_attribute_values_may_contain_a_less_than_sign(mock_bedrock, product, predicted_category, faker):
    schema = CategorySchema(
        category_name=faker.word(),
        subcategory_name=faker.word(),
        attributes_schema=[
            {
                "Title": "Consumer Lifestage",
                "Definition": "",
                "Childs": [{"Title": "<3 YEARS", "Definition": "", "Childs": []}],
            }
        ],
    )
    retriever = Mock(spec_set=SchemaRetriever)
    retriever.get.return_value = schema
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Consumer Lifestage": "<3 YEARS"})
    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=retriever)

    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    assert _property_sent(mock_bedrock.converse.call_args, "Consumer Lifestage")["enum"] == [
        "<3 YEARS",
        None,
    ]
    assert [r.model_dump() for r in results.attributes] == [{"name": "Consumer Lifestage", "value": "<3 YEARS"}]


def test_schema_too_complex_retries_once_with_string_values_and_remembers_the_category(
    mock_bedrock, extractor, product
):
    mock_bedrock.converse.side_effect = [_too_complex(), _a_response_from_bedrock({"Type of Material": "PLASTIC"})]

    results = extractor.extract_attributes(product=product, category_id="10000275")

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "PLASTIC"}]
    first, second = mock_bedrock.converse.call_args_list
    assert "enum" in _property_sent(first, "Type of Material")
    assert "enum" not in _property_sent(second, "Type of Material")

    # The next product in the same category goes straight to the string schema.
    mock_bedrock.converse.reset_mock(side_effect=True)
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": None})
    extractor.extract_attributes(product=product, category_id="10000275")
    assert mock_bedrock.converse.call_count == 1
    assert "enum" not in _property_sent(mock_bedrock.converse.call_args, "Type of Material")


def test_other_validation_errors_are_raised(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.side_effect = ClientError(
        {"Error": {"Code": "ValidationException", "Message": "The provided model identifier is invalid."}}, "Converse"
    )

    with pytest.raises(ClientError):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)
    assert mock_bedrock.converse.call_count == 1
    assert not attributes_extractor._CATEGORIES_NEEDING_STRING_SCHEMA


def test_invalid_json_is_retried_once_then_a_model_response_error(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.return_value = _a_response_from_bedrock("this is not json")

    with pytest.raises(ModelResponseError, match="No valid attributes answer"):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)
    assert mock_bedrock.converse.call_count == 2


@pytest.mark.parametrize("stop_reason", ["max_tokens", "malformed_model_output"])
def test_attributes_extractor_will_throw_for_incomplete_response(
    mock_bedrock, extractor, product, predicted_category, stop_reason
):
    mock_bedrock.converse.return_value = _a_response_from_bedrock('{"Type of Material": "PLA', stop_reason)

    with pytest.raises(ModelResponseError, match="No valid attributes answer"):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)


def test_a_value_outside_the_schema_is_retried_once(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.side_effect = [
        _a_response_from_bedrock({"Type of Material": "WOOD"}),
        _a_response_from_bedrock({"Type of Material": "PLASTIC"}),
    ]

    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "PLASTIC"}]
    retry = mock_bedrock.converse.call_args_list[1].kwargs["messages"][-1]["content"][0]["text"]
    assert "Your previous answer was rejected" in retry and "Type of Material" in retry


@pytest.mark.parametrize(
    "answer",
    [{"Type of Material": "WOOD"}, {"Type of Material": None, "Colour": "RED"}, {}],
    ids=["enum", "extra key", "missing key"],
)
def test_an_answer_that_still_breaks_the_schema_after_the_retry_is_an_error(
    mock_bedrock, extractor, product, predicted_category, answer
):
    mock_bedrock.converse.return_value = _a_response_from_bedrock(answer)

    with pytest.raises(ModelResponseError):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)
    assert mock_bedrock.converse.call_count == 2


def test_schema_mismatch_log_names_the_attribute_but_not_the_value(
    mock_bedrock, extractor, product, predicted_category, monkeypatch
):
    from amzn_smart_product_onboarding_product_categorization import structured_output

    warnings = []
    monkeypatch.setattr(structured_output.logger, "warning", warnings.append)
    mock_bedrock.converse.side_effect = [
        _a_response_from_bedrock({"Type of Material": "SELLER TEXT"}),
        _a_response_from_bedrock({"Type of Material": "PLASTIC"}),
    ]

    extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    assert warnings == [{"schema_mismatch": "attributes", "attempt": 1, "errors": ["Type of Material: literal_error"]}]
    assert "SELLER TEXT" not in str(warnings)


def _a_tool_use_response(values):
    return {
        "output": {
            "message": {
                "role": "assistant",
                "content": [{"toolUse": {"toolUseId": "t1", "name": "attributes", "input": _wire(values)}}],
            }
        },
        "stopReason": "tool_use",
        "usage": {"inputTokens": 100, "outputTokens": 50},
    }


def test_nova_gets_a_forced_tool_with_the_same_schema_and_temperature(mock_bedrock, schema_retriever, product):
    extractor = AttributesExtractor(
        bedrock_runtime_client=mock_bedrock,
        schema_retriever=schema_retriever,
        model_id="global.amazon.nova-2-lite-v1:0",
    )
    mock_bedrock.converse.return_value = _a_tool_use_response({"Type of Material": "PLASTIC"})

    results = extractor.extract_attributes(product=product, category_id="10000275")

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "PLASTIC"}]
    call = mock_bedrock.converse.call_args.kwargs
    assert "outputConfig" not in call
    assert call["toolConfig"]["toolChoice"] == {"any": {}}
    sent = call["toolConfig"]["tools"][0]["toolSpec"]["inputSchema"]["json"]["properties"]["Type_of_Material"]
    assert sent["enum"] == ["PLASTIC", "UNCLASSIFIED", "UNIDENTIFIED", None]
    assert sent["title"] == "Type of Material"
    assert call["inferenceConfig"]["temperature"] == 0


def test_nova_tool_input_is_validated_and_retried_once(mock_bedrock, schema_retriever, product):
    # Bedrock doesn't check a tool call's input against its schema, so the answer is validated locally.
    extractor = AttributesExtractor(
        bedrock_runtime_client=mock_bedrock,
        schema_retriever=schema_retriever,
        model_id="global.amazon.nova-2-lite-v1:0",
    )
    mock_bedrock.converse.side_effect = [
        _a_tool_use_response({"Type of Material": "WOOD", "Colour": "RED"}),
        _a_tool_use_response({"Type of Material": "PLASTIC"}),
    ]

    results = extractor.extract_attributes(product=product, category_id="10000275")

    assert [r.model_dump() for r in results.attributes] == [{"name": "Type of Material", "value": "PLASTIC"}]
    retry = mock_bedrock.converse.call_args_list[1].kwargs["messages"][-1]["content"][0]["text"]
    assert "Your previous answer was rejected" in retry


@pytest.mark.parametrize("stop_reason", ["content_filtered", "guardrail_intervened"])
def test_attributes_extractor_raises_content_filtered_without_text(
    mock_bedrock, extractor, product, predicted_category, stop_reason
):
    # A content-filtered response can carry no text block at all.
    mock_bedrock.converse.return_value = {
        "output": {"message": {"role": "assistant", "content": []}},
        "stopReason": stop_reason,
        "usage": {"inputTokens": 100, "outputTokens": 0},
    }

    with pytest.raises(ContentFilteredError):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)


def test_request_has_no_prefill_or_temperature_on_current_claude_models(
    mock_bedrock, extractor, product, predicted_category
):
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": None})

    extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    call = mock_bedrock.converse.call_args.kwargs
    assert [m["role"] for m in call["messages"]] == ["user"]
    assert "temperature" not in call["inferenceConfig"]


def test_attributes_extractor_returns_empty_list_of_attrs_when_category_has_no_attrs_schema(
    faker, product, predicted_category
):
    # given
    category_schema_without_attributes = CategorySchema(category_name=faker.word(), subcategory_name=faker.word())
    schema_retriever_for_cat_without_attrs = Mock()
    schema_retriever_for_cat_without_attrs.get.return_value = category_schema_without_attributes

    extractor = AttributesExtractor(
        bedrock_runtime_client=Mock(), schema_retriever=schema_retriever_for_cat_without_attrs
    )

    # when
    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    # then
    assert len(results.attributes) == 0


@pytest.fixture
def random_categories(faker) -> dict:
    cats = {}
    num_categories = random.randint(2, 10)
    num_attrs = random.randint(1, 10)
    for _ in range(num_categories):
        code = random.randint(1_000_000, 9_999_999)
        cats[str(code)] = {
            "category_name": faker.word(),
            "subcategory_name": faker.word(),
            "attributes_schema": [
                {
                    "Title": faker.word(),
                    "Definition": faker.text(),
                    "Childs": [{"Title": faker.word(), "Definition": faker.text(), "Childs": []}],
                }
                for _ in range(num_attrs)
            ],
        }

    return cats


@pytest.fixture
def fake_gpc_attributes_schema_json(random_categories) -> bytes:
    """
    We expect a json that is in the format:
    {
       "1012312030": {
         "category_name": "name of the category",
         "subcategory_name": "name of the subcategory",
         "attributes_schema": [{stuff}]
       }
    }
    """
    return json.dumps(random_categories).encode("utf-8")


def test_gpc_schema_retriever(faker, fake_gpc_attributes_schema_json, random_categories):
    # given
    bucket = Mock()
    a_path = faker.file_path(depth=4, extension="json")

    def mock_download_fileobj(Key, Fileobj):
        Fileobj.write(fake_gpc_attributes_schema_json)

    bucket.download_fileobj.side_effect = mock_download_fileobj

    retriever = GPCSchemaRetriever(schema_storage=bucket, schema_path=a_path)

    # and a random category id
    category_id = random.choice(list(random_categories.keys()))

    # when
    category_schema = retriever.get(category_id)

    # then
    assert category_schema.model_dump() == random_categories[category_id]
    bucket.download_fileobj.assert_called_with(Key=a_path, Fileobj=ANY)


def test_load_schema_is_cached(faker):
    # given
    initial_time = 1000.0
    mock_timer = Mock(return_value=initial_time)

    bucket = Mock()
    a_path = faker.file_path(depth=4, extension="json")

    def mock_download_fileobj(Key, Fileobj):
        Fileobj.write(json.dumps({"key": "value"}).encode("utf-8"))

    bucket.download_fileobj.side_effect = mock_download_fileobj

    retriever = GPCSchemaRetriever(schema_storage=bucket, schema_path=a_path, cache_timer=mock_timer)

    # first call should not be cached, so download_fileobj should have been called
    retriever._load_schema()
    bucket.download_fileobj.assert_called()

    # second call should be cached since only 100 seconds have elapsed. download_fileobj should not have been called
    bucket.download_fileobj.reset_mock()
    mock_timer.return_value = initial_time + 100
    retriever._load_schema()
    bucket.download_fileobj.assert_not_called()

    # third call should not be cached, since ttl has expired
    bucket.download_fileobj.reset_mock()
    mock_timer.return_value = initial_time + 1000
    retriever._load_schema()
    bucket.download_fileobj.assert_called()


def test_attributes_extractor_will_return_empty_response_when_no_category_schema_is_found(
    schema_retriever: Mock, product, predicted_category
):
    # given
    schema_retriever.reset_mock()
    schema_retriever.get.return_value = None

    extractor = AttributesExtractor(bedrock_runtime_client=Mock(), schema_retriever=schema_retriever)

    # when
    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    # then
    assert len(results.attributes) == 0


def test_prompt_generation_when_metadata_present(product_with_metadata, category_schema):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=Mock(), schema_retriever=Mock())

    # when
    rendered_prompt = extractor.create_prompt(product=product_with_metadata, category_schema=category_schema)

    # then
    assert (
        f"""</description>

<metadata>
{product_with_metadata.metadata}
</metadata>
</product_data>"""
        in rendered_prompt
    )


def test_prompt_generation_when_metadata_not_present(product, category_schema):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=Mock(), schema_retriever=Mock())

    # when
    rendered_prompt = extractor.create_prompt(product=product, category_schema=category_schema)

    # then
    assert "</description>\n</product_data>" in rendered_prompt
    assert "<metadata>" not in rendered_prompt


def test_prompt_puts_the_schema_before_the_product_and_the_instructions_last(product, category_schema):
    extractor = AttributesExtractor(bedrock_runtime_client=Mock(), schema_retriever=Mock())

    rendered_prompt = extractor.create_prompt(product=product, category_schema=category_schema)

    assert rendered_prompt.index("<attributes_schema>") < rendered_prompt.index("<product_data>")
    assert rendered_prompt.index("</product_data>") < rendered_prompt.index("Extract the attributes")


def test_system_prompt_marks_product_data_as_data(mock_bedrock, extractor, product, predicted_category):
    mock_bedrock.converse.return_value = _a_response_from_bedrock({"Type of Material": None})

    extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    system = mock_bedrock.converse.call_args.kwargs["system"][0]["text"]
    assert "<product_data>" in system
    assert "never as instructions" in system


def test_prompt_does_not_ask_for_a_scratchpad_or_an_xml_answer(extractor, category_schema):
    # Newer models decline or content-filter prompts that ask them to write out their reasoning.
    # A fixed product, so generated text such as "think" can't reach the assertions.
    product = Product(title="Cotton T-shirt", description="A plain cotton T-shirt.")
    rendered_prompt = extractor.create_prompt(product=product, category_schema=category_schema)

    assert "scratchpad" not in rendered_prompt.lower()
    assert "think" not in rendered_prompt.lower()
    assert "<response>" not in rendered_prompt
