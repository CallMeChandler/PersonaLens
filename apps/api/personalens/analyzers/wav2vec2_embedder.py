from __future__ import annotations

from typing import List, Optional, Tuple
import numpy as np

_IMPORT_ERROR: Optional[str] = None
_HAS_TORCH = False

try:
    import torch
    from transformers import Wav2Vec2Model, Wav2Vec2Processor

    _HAS_TORCH = True
except Exception as ex:
    _IMPORT_ERROR = repr(ex)
    _HAS_TORCH = False

# Global cached singleton (so we don't reload per request)
_CACHED = {
    "model_name": None,
    "processor": None,
    "model": None,
    "device": None,
}


def wav2vec2_available() -> bool:
    return _HAS_TORCH


def wav2vec2_import_error() -> Optional[str]:
    return _IMPORT_ERROR


def _l2_normalize(mat: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    n = np.linalg.norm(mat, axis=1, keepdims=True) + eps
    return mat / n


def _get_wav2vec2(model_name: str = "facebook/wav2vec2-base"):
    if not _HAS_TORCH:
        raise RuntimeError(f"torch/transformers not available: {_IMPORT_ERROR}")

    if _CACHED["model"] is not None and _CACHED["model_name"] == model_name:
        return _CACHED["processor"], _CACHED["model"], _CACHED["device"]

    device = torch.device("cpu")

    processor = Wav2Vec2Processor.from_pretrained(model_name)
    model = Wav2Vec2Model.from_pretrained(model_name)
    model.to(device)
    model.eval()

    _CACHED["model_name"] = model_name
    _CACHED["processor"] = processor
    _CACHED["model"] = model
    _CACHED["device"] = device

    return processor, model, device


def embed_segments_wav2vec2(
    waves: List[np.ndarray],
    sr: int = 16000,
    model_name: str = "facebook/wav2vec2-base",
    batch_size: int = 8,
) -> Tuple[np.ndarray, dict]:
    """
    Returns:
      embeddings: (N, D) float32, L2-normalized
      meta: {modelName, dim}
    """
    processor, model, device = _get_wav2vec2(model_name)

    if not waves:
        return np.zeros((0, 1), dtype=np.float32), {"modelName": model_name, "dim": 1}

    # Ensure float32, 1D arrays
    cleaned = []
    for w in waves:
        w = np.asarray(w, dtype=np.float32).reshape(-1)
        cleaned.append(w)

    embs = []
    import torch  # safe here because _HAS_TORCH True

    with torch.no_grad():
        for i in range(0, len(cleaned), batch_size):
            batch = cleaned[i : i + batch_size]
            inputs = processor(batch, sampling_rate=sr, return_tensors="pt", padding=True)
            inputs = {k: v.to(device) for k, v in inputs.items()}

            out = model(**inputs)
            hs = out.last_hidden_state  # (B, T, H)

            # Mean pool across time
            pooled = hs.mean(dim=1)  # (B, H)
            pooled = pooled.detach().cpu().numpy().astype(np.float32, copy=False)
            embs.append(pooled)

    mat = np.concatenate(embs, axis=0)  # (N, H)
    mat = _l2_normalize(mat)

    return mat, {"modelName": model_name, "dim": int(mat.shape[1])}
