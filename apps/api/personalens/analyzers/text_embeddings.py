from __future__ import annotations

from typing import List
import threading

_MODEL = None
_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
_LOCK = threading.Lock()


def get_model():
    global _MODEL
    if _MODEL is None:
        with _LOCK:
            if _MODEL is None:
                from sentence_transformers import SentenceTransformer
                _MODEL = SentenceTransformer(_MODEL_NAME)
    return _MODEL


def embed_text(text: str, normalize: bool = True) -> List[float]:
    model = get_model()
    vec = model.encode(
        [text],
        normalize_embeddings=normalize,
        show_progress_bar=False,
    )[0]
    return vec.tolist()


def embed_texts(texts: List[str], normalize: bool = True) -> List[List[float]]:
    """
    Batch embedding for multiple texts (faster than calling embed_text repeatedly).
    Returns a list of vectors (JSON-serializable).
    """
    model = get_model()
    vecs = model.encode(
        texts,
        normalize_embeddings=normalize,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vecs]


def embedding_model_name() -> str:
    return _MODEL_NAME
