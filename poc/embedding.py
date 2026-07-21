"""
Embedding — dual-mode: offline random projection or OpenAI-compatible API.

Set LLM_MODE in .env:
  "offline" → random projection (default, zero deps)
  "openai"  → OpenAI embeddings API
  "custom"  → custom OpenAI-compatible endpoint
"""

import hashlib
import re
import numpy as np
from config import EMBEDDING_DIM, LLM_MODE, LLM_API_KEY, LLM_BASE_URL, LLM_EMBEDDING_MODEL

# ── Offline mode: Random Projection ──
_PROJ_MATRIX: np.ndarray | None = None
_SEED = 42
_VOCAB_SIZE = 65536


def _get_projection() -> np.ndarray:
    global _PROJ_MATRIX
    if _PROJ_MATRIX is None:
        rng = np.random.default_rng(_SEED)
        _PROJ_MATRIX = rng.normal(
            0.0, 1.0 / np.sqrt(384),  # always 384 for random projection
            size=(_VOCAB_SIZE, 384),
        ).astype(np.float32)
    return _PROJ_MATRIX


def _embed_offline(text: str) -> list[float]:
    proj = _get_projection()
    tokens = re.findall(r"[a-z0-9]{2,}", text.lower())
    bigrams = [tokens[i] + "_" + tokens[i + 1] for i in range(len(tokens) - 1)]
    all_tokens = tokens + bigrams
    if not all_tokens:
        return [0.0] * 384
    indices = np.array(
        [int.from_bytes(hashlib.blake2b(t.encode(), digest_size=8).digest(), "big") % _VOCAB_SIZE
         for t in all_tokens], dtype=np.int32)
    vec = proj[indices].sum(axis=0)
    norm = np.linalg.norm(vec)
    if norm > 1e-8:
        vec /= norm
    return vec.tolist()


# ── LLM mode: OpenAI-compatible API ──
_llm_client = None


def _get_llm_client():
    global _llm_client
    if _llm_client is None and LLM_MODE != "offline":
        if not LLM_API_KEY:
            raise RuntimeError("LLM_API_KEY is required when LLM_MODE is not 'offline'")
        from openai import OpenAI
        _llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _llm_client


def _embed_llm(texts: list[str]) -> list[list[float]]:
    client = _get_llm_client()
    resp = client.embeddings.create(model=LLM_EMBEDDING_MODEL, input=texts)
    return [d.embedding for d in resp.data]


# ── Public API ──

def embed(text: str | list[str]) -> list[list[float]]:
    """Generate embeddings. Returns list of lists always.
    When given a single string, returns [vector]."""
    single = isinstance(text, str)
    texts = [text] if single else text

    if LLM_MODE == "offline":
        result = [_embed_offline(t) for t in texts]
    else:
        result = _embed_llm(texts)

    return result


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))
