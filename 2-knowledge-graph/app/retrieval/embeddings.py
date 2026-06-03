"""Embedding strategies.

``HashEmbedder`` is the default — deterministic, no model download, no network.
It maps tokens to dimensions via stable hashing. It is *not* semantic; it
gives lexical overlap a signal. Real semantic recall is provided by the
``sentence-transformers`` backend when installed and selected via settings.
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import List, Protocol

from app.config import Settings, get_settings


class Embedder(Protocol):
    dimension: int

    def embed(self, text: str) -> List[float]: ...
    def embed_batch(self, texts: List[str]) -> List[List[float]]: ...


class HashEmbedder:
    """Token-hash bag-of-words sparse-dense embedding. Deterministic across processes."""

    def __init__(self, dimension: int = 384) -> None:
        self.dimension = dimension

    def embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dimension
        for token in _tokenize(text):
            idx = _stable_index(token, self.dimension)
            vec[idx] += 1.0
        return _l2_normalise(vec)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed(t) for t in texts]


class SentenceTransformersEmbedder:
    """Wraps sentence-transformers if installed."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as e:
            raise RuntimeError(
                "sentence-transformers not installed. "
                "Install with `pip install '.[embeddings]'` or set COACH_KG_EMBEDDINGS_PROVIDER=hash."
            ) from e
        self._model = SentenceTransformer(model_name)
        self.dimension = int(self._model.get_sentence_embedding_dimension())

    def embed(self, text: str) -> List[float]:
        return [float(x) for x in self._model.encode([text], normalize_embeddings=True)[0]]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [[float(x) for x in row] for row in self._model.encode(texts, normalize_embeddings=True)]


def build_embedder(settings: Settings | None = None) -> Embedder:
    settings = settings or get_settings()
    if settings.embeddings_provider == "sentence-transformers":
        return SentenceTransformersEmbedder(settings.embeddings_model)
    return HashEmbedder(dimension=settings.embeddings_dimension)


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


def _stable_index(token: str, dim: int) -> int:
    digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % dim


def _l2_normalise(vec: List[float]) -> List[float]:
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return vec
    return [v / norm for v in vec]


def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
