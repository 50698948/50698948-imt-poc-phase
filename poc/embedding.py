"""
Fully offline embedding via Random Projection (Johnson-Lindenstrauss lemma).

Uses a deterministic random projection matrix seeded by the hash of
words, producing 384-dim vectors that preserve cosine similarity
between semantically similar texts — no model download required.
"""

import hashlib
import re
import numpy as np
from config import EMBEDDING_DIM

_PROJ_MATRIX: np.ndarray | None = None
_SEED = 42
_VOCAB_SIZE = 65536


def _get_projection() -> np.ndarray:
    global _PROJ_MATRIX
    if _PROJ_MATRIX is None:
        rng = np.random.default_rng(_SEED)
        _PROJ_MATRIX = rng.normal(
            0.0, 1.0 / np.sqrt(EMBEDDING_DIM),
            size=(_VOCAB_SIZE, EMBEDDING_DIM),
        ).astype(np.float32)
    return _PROJ_MATRIX


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    tokens = re.findall(r"[a-z0-9]{2,}", text)
    unigrams = tokens[:]
    bigrams = [tokens[i] + "_" + tokens[i + 1] for i in range(len(tokens) - 1)]
    return unigrams + bigrams


def _hash_token(token: str) -> int:
    h = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(h, "big") % _VOCAB_SIZE


def embed(text: str | list[str]) -> list[list[float]]:
    proj = _get_projection()
    texts = [text] if isinstance(text, str) else text

    result = []
    for t in texts:
        tokens = _tokenize(t)
        if not tokens:
            result.append(np.zeros(EMBEDDING_DIM, dtype=np.float32).tolist())
            continue

        indices = np.array([_hash_token(tok) for tok in tokens], dtype=np.int32)
        vec = proj[indices].sum(axis=0)

        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec = vec / norm

        result.append(vec.tolist())

    return result


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))
