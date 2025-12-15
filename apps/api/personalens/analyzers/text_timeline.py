from __future__ import annotations

from typing import Any, Dict, List
from datetime import date
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


def _centroid(vecs: List[List[float]]) -> List[float]:
    dim = len(vecs[0])
    c = [0.0] * dim
    for v in vecs:
        for i, x in enumerate(v):
            c[i] += x
    c = [x / len(vecs) for x in c]
    # normalize centroid
    n = math.sqrt(sum(x * x for x in c)) or 1.0
    return [x / n for x in c]


def analyze_text_timeline(items: List[Dict[str, str]], window: int = 3, stride: int = 1) -> Dict[str, Any]:
    """
    Timeline drift:
      - Sort items by date.
      - Embed each text (normalized embeddings).
      - Pairwise drift between consecutive posts: drift = (1 - sim(prev,curr)) * 100
      - Rolling-window drift: for each window, compute centroid similarity stats.

    Returns compact stats. Does NOT return embeddings.
    """
    cleaned = []
    for it in items:
        d = (it.get("date") or "").strip()
        t = (it.get("text") or "").strip()
        if not d or not t:
            continue
        try:
            dd = date.fromisoformat(d)  # expects YYYY-MM-DD
        except Exception:
            return {"ok": False, "error": f"Invalid date format: '{d}'. Use YYYY-MM-DD."}
        cleaned.append({"date": dd, "text": t})

    if len(cleaned) < 2:
        return {"ok": False, "error": "Need at least 2 valid (date, text) items."}

    cleaned.sort(key=lambda x: x["date"])
    texts = [x["text"] for x in cleaned]
    dates = [x["date"].isoformat() for x in cleaned]

    vecs = embed_texts(texts, normalize=True)
    n = len(vecs)

    # Pairwise similarity/drift
    pairwise = []
    for i in range(1, n):
        sim = _dot(vecs[i - 1], vecs[i])  # cosine similarity (normalized)
        drift = max(0.0, min(100.0, (1.0 - sim) * 100.0))
        pairwise.append(
            {
                "fromIndex": i - 1,
                "toIndex": i,
                "fromDate": dates[i - 1],
                "toDate": dates[i],
                "similarity": round(sim, 4),
                "driftScore": round(drift, 2),
            }
        )

    # Rolling windows
    w = max(2, int(window))
    if w > n:
        w = n
    s = max(1, int(stride))

    windows = []
    for start in range(0, n - w + 1, s):
        end = start + w  # exclusive
        slice_vecs = vecs[start:end]
        c = _centroid(slice_vecs)
        sims = [_dot(v, c) for v in slice_vecs]
        mean_sim = _mean(sims)
        std_sim = _std(sims)

        drift_score = max(0.0, min(100.0, (1.0 - mean_sim) * 100.0))
        threshold = mean_sim - (1.25 * std_sim)
        outliers_local = [i for i, val in enumerate(sims) if val < threshold]
        outliers_global = [start + i for i in outliers_local]

        windows.append(
            {
                "startIndex": start,
                "endIndex": end - 1,
                "startDate": dates[start],
                "endDate": dates[end - 1],
                "count": w,
                "meanSimilarity": round(mean_sim, 4),
                "minSimilarity": round(min(sims), 4),
                "maxSimilarity": round(max(sims), 4),
                "stdSimilarity": round(std_sim, 4),
                "driftScore": round(drift_score, 2),
                "outlierIndices": outliers_global,
            }
        )

    return {
        "ok": True,
        "embeddingModel": embedding_model_name(),
        "count": n,
        "window": w,
        "stride": s,
        "dates": dates,
        "pairwise": pairwise,
        "windows": windows,
    }
