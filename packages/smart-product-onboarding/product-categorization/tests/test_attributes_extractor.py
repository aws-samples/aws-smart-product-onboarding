# Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import json
import pytest
import random
from unittest.mock import Mock, ANY

from amzn_smart_product_onboarding_core_utils.exceptions import ModelResponseError
from amzn_smart_product_onboarding_product_categorization.attributes_extractor import (
    AttributesExtractor,
    SchemaRetriever,
    CategorySchema,
    GPCSchemaRetriever,
    CategorySchemaNotFound,
)


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


@pytest.fixture
def random_attributes(faker):
    attrs = []
    num_attributes = random.randint(2, 10)
    for _ in range(num_attributes):
        attrs.append({"name": faker.word(), "value": faker.word()})

    return attrs


@pytest.fixture
def text_response_with_random_attributes(random_attributes):
    attrs = ""
    for attr in random_attributes:
        attrs += f"<attribute><name>{attr['name']}</name><value>{attr['value']}</value></attribute>"

    # we return this "invalid" xml because the opening tags are forced on converse model call
    #  the code should put these tags back
    return "stuff here should be ignored</scratchpad>" "<attributes>" f"{attrs}" "</attributes>"


def _a_response_from_bedrock(with_text):
    return {
        "output": {"message": {"content": [{"text": with_text}]}},
        "stopReason": "stop_sequence",
        "usage": {"inputTokens": 100, "outputTokens": 50},
    }


@pytest.fixture
def a_valid_response_from_bedrock(mock_bedrock, text_response_with_random_attributes):
    mock_bedrock.converse.return_value = _a_response_from_bedrock(text_response_with_random_attributes)


@pytest.fixture
def an_invalid_xml_response_from_bedrock(mock_bedrock):
    mock_bedrock.converse.return_value = _a_response_from_bedrock(
        """
    <this_is>supposed to be</invalid_xml>
    """
    )


@pytest.fixture
def an_invalid_pydantic_response_from_bedrock(mock_bedrock):
    mock_bedrock.converse.return_value = _a_response_from_bedrock(
        """
    this is ignored</scratchpad><valid>this is valid xml, but does not match the pydantic model</valid>
    """
    )


@pytest.fixture
def schema_retriever(category_schema):
    schema_retriever = Mock(spec_set=SchemaRetriever)
    schema_retriever.get.return_value = category_schema
    return schema_retriever


def test_attributes_extractor_when_category_is_found(
    mock_bedrock, schema_retriever, a_valid_response_from_bedrock, random_attributes, product, predicted_category
):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)

    # when
    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    # then
    assert len(results.attributes) == len(random_attributes)
    assert [r.model_dump() for r in results.attributes] == random_attributes


def test_attributes_extractor_will_throw_xml_validation_error(
    mock_bedrock, schema_retriever, an_invalid_xml_response_from_bedrock, product, predicted_category
):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)

    # then
    with pytest.raises(ModelResponseError, match="Failed to parse extracted attributes from response"):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)


def test_attributes_extractor_will_throw_pydantic_validation_error_when_cant_inflate_Attributes(
    mock_bedrock, schema_retriever, an_invalid_pydantic_response_from_bedrock, product, predicted_category
):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)

    # then
    with pytest.raises(ModelResponseError, match="Failed to parse extracted attributes from response"):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)


def test_attributes_extractor_with_single_attribute(mock_bedrock, schema_retriever, product, predicted_category):
    # given
    mock_bedrock.converse.return_value = _a_response_from_bedrock(
        """
    Analyzing the attributes schema and product information:
    1. Fixed Installation/Portable:
    - The title and description don't explicitly mention if the mouse is fixed or portable.
    - However, being a gaming mouse, it's typically portable.
    - The description mentions "wired PC gaming mouse", which suggests it can be connected and
    disconnected.
    - Value: PORTABLE
    Conclusion:
    - Fixed Installation/Portable: PORTABLE
</scratchpad>
  <attributes>
    <attribute>
      <name>Fixed Installation/Portable</name>
      <value>PORTABLE</value>
    </attribute>
  </attributes>
        """
    )

    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)

    # when
    results = extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)

    # then
    assert len(results.attributes) == 1
    assert results.attributes[0].model_dump() == {"name": "Fixed Installation/Portable", "value": "PORTABLE"}


def test_attributes_extractor_will_throw_for_invalid_stop_reason(
    faker, mock_bedrock, schema_retriever, product, predicted_category
):
    an_invalid_stop_reason = faker.word()

    mock_bedrock.converse.return_value = {
        "output": {"message": {"content": [{"text": "any text, doesn't matter in this test"}]}},
        "stopReason": an_invalid_stop_reason,
        "usage": {"inputTokens": 100, "outputTokens": 50},
    }

    # given
    extractor = AttributesExtractor(bedrock_runtime_client=mock_bedrock, schema_retriever=schema_retriever)

    # then
    with pytest.raises(ModelResponseError, match=f"Invalid stop reason: {an_invalid_stop_reason}"):
        extractor.extract_attributes(product=product, category_id=predicted_category.predicted_category_id)


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

Your task is to extract the actual attributes and their values from the title and description."""
        in rendered_prompt
    )


def test_prompt_generation_when_metadata_not_present(product, category_schema):
    # given
    extractor = AttributesExtractor(bedrock_runtime_client=Mock(), schema_retriever=Mock())

    # when
    rendered_prompt = extractor.create_prompt(product=product, category_schema=category_schema)

    # then -- TODO: figure out a way to remove the double \n between closing description tag and task instruction
    assert (
        f"""</description>


Your task is to extract the actual attributes and their values from the title and description."""
        in rendered_prompt
    )
