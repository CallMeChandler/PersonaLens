import re
from typing import List, Optional, Dict, Any

BUZZWORDS = [
    "synergy","leverage","scalable","disrupt","disruption","ai","ml","deep learning","blockchain",
    "growth hacking","10x","impact","visionary","thought leader","innovative","cutting-edge",
    "end-to-end","stakeholder","alignment","strategic","value-add","paradigm","robust","seamless",
    "world-class","best-in-class","genai","llm","agentic","transformative"
]

HEDGES = ["maybe","probably","possibly","somewhat","kind of","sort of","i think","i guess","perhaps"]
ABSOLUTES = ["always","never","guaranteed","everyone","no one","undeniable","proven","certainly","definitely"]


def normalize(text: Optional[str]) -> str:
    return (text or "").lower()


def word_list(text: str) -> List[str]:
    """
    Basic tokenizer for counting words (not NLP-grade tokenization).
    Keeps hyphenated and plus-joined words intact (e.g., 'end-to-end').
    """
    t = normalize(text)
    return re.findall(r"[a-z0-9]+(?:[-+][a-z0-9]+)*", t)


def count_phrases(text: str, phrases: List[str]) -> int:
    """
    Counts occurrences of each phrase in `phrases` within `text`.
    Uses word-boundary guards on both ends to reduce substring matches.
    """
    t = normalize(text)
    total = 0
    for p in phrases:
        pat = r"\b" + re.escape(p) + r"\b"
        total += len(re.findall(pat, t))
    return total


_METRIC_RE = re.compile(
    r"(?:\b\d+(?:\.\d+)?\b)|(?:%|\$|₹)|(?:\bq[1-4]\b)|(?:\b20\d{2}\b)",
    flags=re.IGNORECASE
)


def analyze_text_signals(text: str) -> Dict[str, Any]:
    """
    Returns a dictionary of surface-level linguistic signals.

    This is a heuristic baseline. It does not claim factual truth.
    Later, we'll replace/augment this with transformer-based inference.
    """
    words = word_list(text)
    word_count = len(words)

    sentences = [s.strip() for s in re.split(r"[.!?]+", text or "") if s.strip()]
    sentence_count = max(1, len(sentences))

    buzzword_hits = count_phrases(text, BUZZWORDS)
    hedge_hits = count_phrases(text, HEDGES)
    absolute_hits = count_phrases(text, ABSOLUTES)

    metric_hits = len(list(_METRIC_RE.finditer(text or "")))

    buzzword_per_100 = (buzzword_hits / word_count) * 100 if word_count else 0.0

    # Baseline scoring (signal score, not a verdict)
    score = 60
    score += min(20, metric_hits * 2)
    score -= min(30, buzzword_per_100 * 2)
    score -= min(15, absolute_hits * 2)
    score -= min(10, hedge_hits * 1)
    score = max(0, min(100, round(score)))

    return {
        "score": score,
        "wordCount": word_count,
        "sentenceCount": sentence_count,
        "metricHits": metric_hits,
        "buzzwordHits": buzzword_hits,
        "hedgeHits": hedge_hits,
        "absoluteHits": absolute_hits,
        "buzzwordPer100Words": round(buzzword_per_100, 1),
    }
