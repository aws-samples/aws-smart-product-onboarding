from typing import TYPE_CHECKING

import faiss
import numpy as np

if TYPE_CHECKING:
    import numpy.typing as npt


class CategoryVectorIndex:
    """A vector index for efficient similarity search of category vectors using FAISS.

    This class creates and manages a FAISS index optimized for cosine similarity search
    between category vectors. It normalizes all vectors during initialization and provides
    methods to search for similar categories given a query vector.

    Attributes:
        index (faiss.IndexFlat): FAISS index for vector similarity search
        word_index (list[str]): List of category words corresponding to the vectors in the index

    Args:
        category_vectors (dict[str, list[float]]): Dictionary mapping category words to their vector representations
        dimensions (int): Dimensionality of the vectors

    Raises:
        ValueError: If category_vectors is empty or if vector dimensions don't match the specified dimensions
    """

    def __init__(self, category_vectors: dict[str, list[float]], dimensions: int):
        """Initialize the CategoryVectorIndex with category vectors.

        Creates a FAISS index using the provided category vectors, normalizing them
        for cosine similarity search. The index is configured to use inner product
        metric which, with normalized vectors, is equivalent to cosine similarity.

        Args:
            category_vectors: Dictionary mapping category words to their vector representations
            dimensions: Dimensionality of the vectors

        Raises:
            ValueError: If category_vectors is empty or if vector dimensions don't match
            faiss.RuntimeError: If there's an error creating or adding to the FAISS index
        """
        self.index = faiss.index_factory(dimensions, "Flat", faiss.METRIC_INNER_PRODUCT)
        index_array = np.array([v for v in category_vectors.values()], np.float32)
        faiss.normalize_L2(index_array)
        self.index.add(index_array)
        self.word_index = list(category_vectors.keys())

    def search(
        self, query_vector: "npt.NDArray[np.float32]", k: int, threshold: float
    ) -> list[tuple[str, float]]:
        """Search for the k most similar category vectors to the query vector.

        Performs a similarity search using the FAISS index and returns categories
        whose similarity scores are above the specified threshold.

        Args:
            query_vector: Query vector for similarity search. Can be either 1D or 2D numpy array.
                If 1D, it will be reshaped to 2D (1, dimensions).
            k: Number of nearest neighbors to retrieve
            threshold: Minimum similarity score for results to be included

        Returns:
            List of tuples containing (category_word, similarity_score),
            sorted by similarity score in descending order.
            Only results with similarity scores above the threshold are included.

        Raises:
            ValueError: If query_vector dimensions don't match the index dimensions
            ValueError: If k < 1
            faiss.RuntimeError: If there's an error during the search operation

        Examples:
            >>> index = CategoryVectorIndex(category_vectors, 300)
            >>> results = index.search(query_vector, k=5, threshold=0.7)
            >>> for category, score in results:
            ...     print(f"{category}: {score}")
        """
        # Ensure query_vector is 2D
        if query_vector.ndim == 1:
            query_vector = query_vector.reshape(1, -1)

        distances, indices = self.index.search(query_vector, k)
        results = []
        for distance, index in zip(distances[0], indices[0]):
            if distance > threshold:
                results.append((self.word_index[index], float(distance)))
        return results
