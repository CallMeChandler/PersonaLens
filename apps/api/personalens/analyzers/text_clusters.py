from __future__ import annotations

import math
import random
import re
from typing import Any, Dict, List, Optional

from personalens.analyzers.text_embeddings import embed_texts, embedding_model_name

_STOPWORDS = {
    "a","an","the","and","or","but","if","then","else","when","while","for","to","of","in","on","at","by","from",
    "is","are","was","were","be","been","being","as","with","without","into","about","over","under","between",
    "this","that","these","those","it","its","they","them","their","you","your","we","our","i","me","my",
    "can","could","should","would","may","might","will","just","only","also","very","more","most","less","few",
    "than","too","not","no","yes","do","does","did","done","have","has","had",
}

def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))

def _norm(v: List[float]) -> float:
    return math.sqrt(sum(x * x for x in v)) or 1.0

def _normalize(v: List[float]) -> List[float]:
    n = _norm(v)
    return [x / n for x in v]

def _mean_vec(vecs: List[List[float]]) -> List[float]:
    dim = len(vecs[0])
    out = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            out[i] += x
    out = [x / len(vecs) for x in out]
    return _normalize(out)

def _extract_keywords(text: str, k: int = 6) -> List[str]:
    toks = re.findall(r"[a-z0-9]+(?:[-+][a-z0-9]+)*", (text or "").lower())
    freq: Dict[str, int] = {}
    for t in toks:
        if len(t) < 3:
            continue
        if t in _STOPWORDS:
            continue
        freq[t] = freq.get(t, 0) + 1
    ranked = sorted(freq.items(), key=lambda kv: (kv[1], len(kv[0])), reverse=True)
    return [w for w, _ in ranked[:k]]

def _kmeans_cosine(
    vecs: List[List[float]],
    k: int,
    seed: int = 42,
    max_iter: int = 25,
) -> Dict[str, Any]:
    """
    K-means on unit-normalized vectors using cosine distance.
    Since vectors are normalized, cosine similarity = dot product.
    Distance = 1 - similarity.
    """
    n = len(vecs)
    if k < 2:
        k = 2
    if k > n:
        k = n

    rnd = random.Random(seed)
    init_idx = rnd.sample(range(n), k)
    centroids = [vecs[i][:] for i in init_idx]  # already normalized

    assignments = [-1] * n

    for _ in range(max_iter):
        changed = False

        # Assign step
        for i, v in enumerate(vecs):
            best_c = 0
            best_sim = _dot(v, centroids[0])
            for c in range(1, k):
                sim = _dot(v, centroids[c])
                if sim > best_sim:
                    best_sim = sim
                    best_c = c
            if assignments[i] != best_c:
                assignments[i] = best_c
                changed = True

        if not changed:
            break

        # Update step
        buckets: List[List[int]] = [[] for _ in range(k)]
        for i, c in enumerate(assignments):
            buckets[c].append(i)

        for c in range(k):
            if not buckets[c]:
                # Re-seed empty cluster with a random point
                centroids[c] = vecs[rnd.randrange(n)][:]
                continue
            cluster_vecs = [vecs[i] for i in buckets[c]]
            centroids[c] = _mean_vec(cluster_vecs)

    return {"k": k, "assignments": assignments, "centroids": centroids}

def analyze_text_clusters(
    texts: List[str],
    k: int = 3,
    seed: int = 42,
    max_iter: int = 25,
) -> Dict[str, Any]:
    cleaned = [(t or "").strip() for t in (texts or []) if (t or "").strip()]
    if len(cleaned) < 2:
        return {"ok": False, "error": "Need at least 2 non-empty texts to cluster."}

    vecs = embed_texts(cleaned, normalize=True)  # unit vectors
    km = _kmeans_cosine(vecs, k=k, seed=seed, max_iter=max_iter)

    assignments = km["assignments"]
    centroids = km["centroids"]
    k_used = km["k"]

    # Cluster members
    members: List[List[int]] = [[] for _ in range(k_used)]
    for i, c in enumerate(assignments):
        members[c].append(i)

    # Build cluster summaries
    clusters = []
    for c in range(k_used):
        idxs = members[c]
        if not idxs:
            clusters.append(
                {
                    "clusterId": c,
                    "size": 0,
                    "label": f"Cluster {c}",
                    "representativeIndex": None,
                    "topKeywords": [],
                    "avgSimilarity": None,
                }
            )
            continue

        centroid = centroids[c]
        sims = [float(_dot(vecs[i], centroid)) for i in idxs]
        avg_sim = sum(sims) / len(sims)

        # representative = closest to centroid (highest similarity)
        rep_local = max(range(len(idxs)), key=lambda j: sims[j])
        rep_idx = idxs[rep_local]
        rep_text = cleaned[rep_idx]

        # keywords: merge rep keywords + a little from members
        kw = _extract_keywords(rep_text, k=6)
        if len(kw) < 6:
            # backfill with frequent keywords from other members
            freq: Dict[str, int] = {}
            for i in idxs:
                for w in _extract_keywords(cleaned[i], k=6):
                    freq[w] = freq.get(w, 0) + 1
            extra = [w for w, _ in sorted(freq.items(), key=lambda kv: kv[1], reverse=True) if w not in kw]
            kw = (kw + extra)[:6]

        label = " / ".join(kw[:3]) if kw else f"Cluster {c}"

        clusters.append(
            {
                "clusterId": c,
                "size": len(idxs),
                "label": label,
                "representativeIndex": rep_idx,
                "representativeText": rep_text,
                "topKeywords": kw,
                "avgSimilarity": round(avg_sim, 4),
            }
        )

    items = [{"index": i, "clusterId": assignments[i]} for i in range(len(cleaned))]

    return {
        "ok": True,
        "embeddingModel": embedding_model_name(),
        "count": len(cleaned),
        "k": k_used,
        "seed": seed,
        "items": items,
        "clusters": clusters,
    }
