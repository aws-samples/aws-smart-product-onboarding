# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from decimal import Decimal
from typing import Optional, TYPE_CHECKING, Sequence, Union

import faiss
import numpy as np
import time

from amzn_smart_product_onboarding_metaclasses.VectorRepository import VectorRepository

if TYPE_CHECKING:
    from mypy_boto3_dynamodb import DynamoDBClient
    import numpy.typing as npt


class DynamoDBVectorRepository(VectorRepository):
    def __init__(self, dynamodb_client: "DynamoDBClient", table_name: str):
        self.dynamodb_client = dynamodb_client
        self.table = table_name
        self.vector_cache: dict[str, "npt.NDArray[np.float32]"] = {}

    def get_cached_vector(self, word: str) -> Optional["npt.NDArray[np.float32]"]:
        return self.vector_cache.get(word)

    def cache_vector(self, word: str, vector: "npt.NDArray[np.float32]") -> None:
        self.vector_cache[word] = vector

    def get_vectors_by_words(
        self, words: list[str]
    ) -> list[Union[None, "npt.NDArray[np.float32]"]]:
        word_vectors: list[Union[None, "npt.NDArray[np.float32]"]] = [None] * len(words)
        word_to_index: dict[str, int] = {word: idx for idx, word in enumerate(words)}
        keys_to_fetch = []

        # Check cache first
        for word in words:
            cached_vector = self.get_cached_vector(word)
            if cached_vector is not None:
                word_vectors[word_to_index[word]] = cached_vector
            else:
                keys_to_fetch.append({"word": {"S": word}})

        if not keys_to_fetch:
            return word_vectors

        # Prepare DynamoDB batch request in chunks of 100 keys
        for i in range(0, len(keys_to_fetch), 100):
            chunk = keys_to_fetch[i : i + 100]
            request_items = {self.table: {"Keys": chunk}}

            # Handle batch get with retries
            backoff_time = 0.1
            max_retries = 3
            retries = 0

            while request_items:
                response = self.dynamodb_client.batch_get_item(
                    RequestItems=request_items
                )

                for item in response["Responses"][self.table]:
                    vector = self._extract_normalized_vector(item["vector"]["L"])
                    word = item["word"]["S"]
                    word_vectors[word_to_index[word]] = vector
                    self.cache_vector(word, vector)

                if "UnprocessedKeys" in response:
                    if retries >= max_retries:
                        raise RuntimeError("Max retries exceeded for batch_get_item")
                    time.sleep(backoff_time)
                    backoff_time *= 2
                    retries += 1
                    request_items = response["UnprocessedKeys"]
                else:
                    request_items = None

        return word_vectors

    @staticmethod
    def _extract_normalized_vector(
        vector_data: Sequence[dict[str, Decimal]]
    ) -> "npt.NDArray[np.float32]":
        vector = [float(v["N"]) for v in vector_data]
        sv = np.array([vector], np.float32)
        faiss.normalize_L2(sv)
        return sv
