# Copyright (c) 2025 Amazon.com, Inc. or its affiliates
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to
# use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
# the Software, and to permit persons to whom the Software is furnished to do so,
# subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# test_category_vector_index.py
import faiss
import numpy as np
import pytest

from amzn_smart_product_onboarding_metaclasses.category_vector_index import (
    CategoryVectorIndex,
)


@pytest.fixture
def sample_vectors():
    return {"book": [1.0, 0.0, 0.0], "toy": [0.0, 1.0, 0.0], "game": [0.0, 0.0, 1.0]}


@pytest.fixture
def vector_index(sample_vectors):
    return CategoryVectorIndex(sample_vectors, dimensions=3)


def test_initialization():
    vectors = {"test1": [1.0, 0.0], "test2": [0.0, 1.0]}
    index = CategoryVectorIndex(vectors, dimensions=2)

    assert isinstance(index.index, faiss.IndexFlat)
    assert len(index.word_index) == 2
    assert index.word_index == ["test1", "test2"]


def test_search_exact_match(vector_index):
    # Search for exact match of "book" vector
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    results = vector_index.search(query, k=1, threshold=0.5)

    assert len(results) == 1
    assert results[0][0] == "book"
    assert np.isclose(results[0][1], 1.0, atol=1e-5)


def test_search_no_matches(vector_index):
    # Search with a vector that shouldn't match anything above threshold
    query = np.array([-1.0, -1.0, -1.0], dtype=np.float32)
    results = vector_index.search(query, k=1, threshold=0.5)

    assert len(results) == 0


def test_search_multiple_results(vector_index):
    # Search for multiple results
    query = np.array(
        [0.707, 0.707, 0.0], dtype=np.float32
    )  # Vector between book and toy
    results = vector_index.search(query, k=2, threshold=0.5)

    assert len(results) <= 2
    for result in results:
        assert result[0] in ["book", "toy"]
        assert 0.5 <= result[1] <= 1.0


def test_threshold_filtering(vector_index):
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

    # Test with low threshold
    low_threshold_results = vector_index.search(query, k=3, threshold=0.1)

    # Test with high threshold
    high_threshold_results = vector_index.search(query, k=3, threshold=0.9)

    assert len(low_threshold_results) >= len(high_threshold_results)


def test_vector_normalization():
    # Test that vectors are properly normalized during initialization
    vectors = {"test": [2.0, 0.0, 0.0]}  # Non-normalized vector
    index = CategoryVectorIndex(vectors, dimensions=3)

    # Search with normalized query vector
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    results = index.search(query, k=1, threshold=0.5)

    assert len(results) == 1
    assert np.isclose(results[0][1], 1.0, atol=1e-5)


def test_empty_vectors():
    with pytest.raises(Exception):
        CategoryVectorIndex({}, dimensions=3)


def test_invalid_dimensions():
    vectors = {"test": [1.0, 0.0, 0.0]}  # 3D vector
    with pytest.raises(Exception):
        CategoryVectorIndex(vectors, dimensions=2)  # Incorrect dimensions


def test_search_with_invalid_k(vector_index):
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

    # Test with k=0
    with pytest.raises(Exception):
        vector_index.search(query, k=0, threshold=0.5)


def test_search_with_k_larger_than_index(vector_index):
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

    # Test with k larger than number of vectors
    results = vector_index.search(query, k=10, threshold=0.5)

    assert len(results) <= len(vector_index.word_index)


def test_consistent_results(vector_index):
    query = np.array([1.0, 0.0, 0.0], dtype=np.float32)

    # Run search multiple times and verify consistent results
    results1 = vector_index.search(query, k=1, threshold=0.5)
    results2 = vector_index.search(query, k=1, threshold=0.5)

    assert results1 == results2


def test_vector_dimensionality():
    vectors = {"test": [1.0, 0.0, 0.0]}
    index = CategoryVectorIndex(vectors, dimensions=3)

    # Test with wrong dimensionality query
    invalid_query = np.array([1.0, 0.0], dtype=np.float32)
    with pytest.raises(Exception):
        index.search(invalid_query, k=1, threshold=0.5)
