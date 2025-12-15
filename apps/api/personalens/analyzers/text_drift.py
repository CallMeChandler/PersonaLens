from __future__ import annotations

from typing import Any, Dict, List
import math

from personalens.analyzers.text_embeddings import embed_texts, embedding_model_name


def _dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _mean(xs: List[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _std(xs: List[float]) -> float:
    if len(xs) <= 1:
        return 0.0
    m = _mean(xs)
    var = sum((x - m) ** 2 for x in xs) / (len(xs) - 1)
    return math.sqrt(var)


def analyze_text_drift(texts: List[str]) -> Dict[str, Any]:
    """
    Computes semantic consistency/drift using transformer embeddings.

    Assumes embeddings are normalized (unit length). Then cosine similarity == dot product.
    Strategy:
      1) Embed all texts (normalized).
      2) Compute a centroid embedding (mean vector), then normalize it.
      3) Compute each text's similarity to the centroid.
      4) Summarize similarities; convert to a drift score.

    Output is intentionally compact (no embedding vectors returned).
    """
    cleaned = [t.strip() for t in texts if t and t.strip()]
    if len(cleaned) < 2:
        return {
            "ok": False,
            "error": "Need at least 2 non-empty texts to compute drift.",
        }

    vecs = embed_texts(cleaned, normalize=True)
    dim = len(vecs[0]) if vecs else 0

    # centroid = mean(vecs) then normalize to unit length
    centroid = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            centroid[i] += x
    centroid = [x / len(vecs) for x in centroid]

    norm = math.sqrt(sum(x * x for x in centroid)) or 1.0
    centroid = [x / norm for x in centroid]

    sims = [_dot(v, centroid) for v in vecs]  # cosine similarity to centroid
    mean_sim = _mean(sims)
    min_sim = min(sims)
    max_sim = max(sims)
    std_sim = _std(sims)

    # Convert similarity to a “drift score” on 0..100:
    # high similarity => low drift
    # drift = (1 - mean_sim) scaled
    drift_score = max(0.0, min(100.0, (1.0 - mean_sim) * 100.0))

    # Identify outliers: anything much lower than the mean
    # threshold: mean - 1.25 * std (simple, interpretable baseline)
    threshold = mean_sim - (1.25 * std_sim)
    outlier_indices = [i for i, s in enumerate(sims) if s < threshold]

    return {
        "ok": True,
        "embeddingModel": embedding_model_name(),
        "count": len(cleaned),
        "embeddingDim": dim,
        "similarityToCentroid": [round(s, 4) for s in sims],
        "meanSimilarity": round(mean_sim, 4),
        "minSimilarity": round(min_sim, 4),
        "maxSimilarity": round(max_sim, 4),
        "stdSimilarity": round(std_sim, 4),
        "driftScore": round(drift_score, 2),
        "outlierIndices": outlier_indices,
    }
