from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional

from personalens.analyzers.text_signals import analyze_text_signals
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
    n = math.sqrt(sum(x * x for x in c)) or 1.0
    return [x / n for x in c]


def _extract_keywords(text: str, k: int = 6) -> List[str]:
    """
    Lightweight keyword extraction (no extra deps):
    - lowercases
    - tokenizes
    - removes stopwords
    - returns top-k by frequency, ties by token length
    """
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


def _reason_tags(signals: Dict[str, Any], sim_to_centroid: Optional[float], is_outlier: bool) -> List[str]:
    tags: List[str] = []

    wc = int(signals.get("wordCount", 0) or 0)
    metrics = int(signals.get("metricHits", 0) or 0)
    buzz = int(signals.get("buzzwordHits", 0) or 0)
    buzz_per_100 = float(signals.get("buzzwordPer100Words", 0.0) or 0.0)
    abs_hits = int(signals.get("absoluteHits", 0) or 0)
    hedge = int(signals.get("hedgeHits", 0) or 0)

    if wc < 20:
        tags.append("Very short (noisy signal)")
    if metrics == 0:
        tags.append("Low specificity (few/no metrics)")
    if metrics >= 3:
        tags.append("Has measurable specifics")

    if buzz_per_100 >= 2.0:
        tags.append("High buzzword density")
    elif buzz >= 3:
        tags.append("Buzzword-heavy")

    if abs_hits >= 2:
        tags.append("Overconfident language")
    if hedge >= 2:
        tags.append("Hedging language")

    if is_outlier:
        tags.append("Semantic outlier vs timeline")

    # Keep it compact
    return tags[:5]


def analyze_text_reasons(
    texts: List[str],
    indices: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """
    Batch reasons:
      - per text: heuristic signals (existing)
      - set-level: compute centroid in embedding space (if >=2 texts)
      - per text: similarity to centroid + semantic outlier flag
      - per text: reason tags + lightweight keywords
    """
    cleaned = [(t or "").strip() for t in (texts or [])]
    if not cleaned:
        return {"ok": False, "error": "No texts provided."}

    # optional subset selection (useful for “only outliers”)
    if indices is not None:
        keep = []
        keep_map = []
        for idx in indices:
            if isinstance(idx, int) and 0 <= idx < len(cleaned):
                keep.append(cleaned[idx])
                keep_map.append(idx)
        cleaned_subset = keep
        subset_to_original = keep_map
    else:
        cleaned_subset = cleaned
        subset_to_original = list(range(len(cleaned)))

    # Heuristic signals for each
    sigs = [analyze_text_signals(t) for t in cleaned_subset]

    sims: Optional[List[float]] = None
    outlier_local: List[int] = []

    if len(cleaned_subset) >= 2:
        vecs = embed_texts(cleaned_subset, normalize=True)
        c = _centroid(vecs)
        sims = [_dot(v, c) for v in vecs]

        mean_sim = _mean(sims)
        std_sim = _std(sims)
        threshold = mean_sim - (1.25 * std_sim)
        outlier_local = [i for i, s in enumerate(sims) if s < threshold]

    outlier_set = set(outlier_local)

    items = []
    for i, (t, s) in enumerate(zip(cleaned_subset, sigs)):
        sim = round(float(sims[i]), 4) if sims is not None else None
        is_out = i in outlier_set
        tags = _reason_tags(s, sim, is_out)
        keywords = _extract_keywords(t, k=6)

        items.append(
            {
                "index": subset_to_original[i],
                "signals": s,
                "semanticSimilarityToCentroid": sim,
                "semanticOutlier": is_out,
                "reasonTags": tags,
                "keywords": keywords,
            }
        )

    return {
        "ok": True,
        "embeddingModel": embedding_model_name() if len(cleaned_subset) >= 2 else None,
        "count": len(cleaned_subset),
        "items": items,
    }
