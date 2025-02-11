# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from abc import ABC, abstractmethod
from typing import Optional, TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    import numpy.typing as npt


class VectorRepository(ABC):
    @abstractmethod
    def get_vectors_by_words(self, words: list[str]) -> "list[npt.NDArray[np.float32]]":
        pass

    @abstractmethod
    def cache_vector(self, word: str, vector: "npt.NDArray[np.float32]") -> None:
        pass

    @abstractmethod
    def get_cached_vector(self, word: str) -> Optional["npt.NDArray[np.float32]"]:
        pass
