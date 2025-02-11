# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest

from amzn_smart_product_onboarding_metaclasses.text_cleaner import TextCleaner


@pytest.fixture
def text_cleaner():
    return TextCleaner(
        singularize={"geese": "goose", "mice": "mouse"},
        brands=["Apple", "Samsung"],
        synonyms={"laptop": "computer", "phone": "mobile"},
        descriptors=["new", "improved"],
        language="english",
    )


def test_clean_text(text_cleaner):
    input_text = "New Apple Laptop (15-inch) - 2020 Model"
    expected_output = "computer model"
    assert text_cleaner.clean_text(input_text) == expected_output


def test_replace_direct(text_cleaner):
    assert text_cleaner._replace_direct("a/c unit") == "air conditioner unit"
    assert text_cleaner._replace_direct("item other") == "item"
    assert text_cleaner._replace_direct("foo - bar") == "foo  bar"
    assert text_cleaner._replace_direct("foo/bar") == "foo bar"


def test_replace_re(text_cleaner):
    assert text_cleaner._replace_re("item  (in stock)") == "item"
    assert text_cleaner._replace_re("áéíóú") == "aeiou"


def test_split_plants(text_cleaner):
    assert text_cleaner._split_plants("roseplants") == ["rose", "plants"]
    assert text_cleaner._split_plants("computer") == ["computer"]


def test_singularize_word(text_cleaner):
    assert text_cleaner.singularize_word("geese") == "goose"
    assert text_cleaner.singularize_word("cats") == "cat"
    assert text_cleaner.singularize_word("mouse") == "mouse"


def test_remove_descriptors(text_cleaner):
    assert text_cleaner._remove_descriptors("new improved product") == "product"


def test_remove_stopwords_tokenize_text(text_cleaner):
    assert (
        text_cleaner._remove_stopwords_tokenize_text("the quick brown fox")
        == "quick brown fox"
    )


def test_remove_html_tags(text_cleaner):
    assert text_cleaner._remove_html_tags("<p>hello</p> <b>world</b>") == "hello world"


def test_remove_packages(text_cleaner):
    assert text_cleaner._remove_packages("Product pack x3") == "Product"


def test_remove_dimensions(text_cleaner):
    assert text_cleaner._remove_dimensions("Item 10x20") == "Item"


def test_remove_brands(text_cleaner):
    assert (
        text_cleaner._remove_brands("apple iphone samsung galaxy") == " iphone  galaxy"
    )


def test_replace_synonyms(text_cleaner):
    assert text_cleaner._replace_synonyms("laptop") == "computer"
    assert text_cleaner._replace_synonyms("desktop") == "desktop"
