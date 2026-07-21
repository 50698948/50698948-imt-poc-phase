"""
Hybrid retrieval pipeline: multi-path recall → RRF fusion.
"""

from typing import Optional

from config import RRF_K, MERGE_TOPK
from db import search_by_vector, search_by_fts, search_by_structure


def rrf_fusion(
    result_sets: list[list[dict]],
    k: int = RRF_K,
    top_k: int = MERGE_TOPK,
) -> list[dict]:
    """Reciprocal Rank Fusion across multiple ranked lists.

    Each list in *result_sets* is assumed to be ranked (best first).
    Returns a merged list of unique tickets sorted by RRF score desc.
    """
    score_map: dict[str, float] = {}
    doc_map: dict[str, dict] = {}

    for rank_list in result_sets:
        for rank, doc in enumerate(rank_list):
            doc_id = doc["id"]
            rrf = 1.0 / (k + rank + 1)
            score_map[doc_id] = score_map.get(doc_id, 0.0) + rrf
            if doc_id not in doc_map:
                doc_map[doc_id] = doc

    sorted_ids = sorted(score_map, key=lambda x: score_map[x], reverse=True)
    merged = []
    for doc_id in sorted_ids[:top_k]:
        doc = dict(doc_map[doc_id])
        doc["rrf_score"] = score_map[doc_id]
        merged.append(doc)
    return merged


def retrieve(
    current_ticket: dict,
    *,
    query_text: str | None = None,
    top_k: int = MERGE_TOPK,
) -> list[dict]:
    """Full hybrid retrieval for a given current ticket.

    Builds *query_text* from title + description if not provided.
    """
    if query_text is None:
        query_text = f"{current_ticket['title']} {current_ticket['description']}"

    svc = current_ticket.get("service_name", "")
    cat = current_ticket.get("category", "")
    sev = current_ticket.get("severity", "P1")
    etyp = current_ticket.get("error_type")

    # ── 3-path recall ──
    vec_results = search_by_vector(query_text)
    fts_results = search_by_fts(query_text)
    struct_results = search_by_structure(
        service_name=svc, category=cat, severity=sev, error_type=etyp
    )

    # ── RRF fusion ──
    merged = rrf_fusion([vec_results, fts_results, struct_results], k=RRF_K, top_k=top_k)

    return merged
