from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import List, Tuple

import numpy as np
import torch
from transformers import VideoMAEImageProcessor, VideoMAEModel


@dataclass(frozen=True)
class _VideoMAEBundle:
    processor: VideoMAEImageProcessor
    model: VideoMAEModel
    device: torch.device


@lru_cache(maxsize=4)
def _get_videomae_bundle(model_name: str, device_str: str) -> _VideoMAEBundle:
    device = torch.device(device_str)

    processor = VideoMAEImageProcessor.from_pretrained(model_name)
    model = VideoMAEModel.from_pretrained(model_name)
    model.eval()
    model.to(device)

    return _VideoMAEBundle(processor=processor, model=model, device=device)


def _l2_normalize(v: torch.Tensor, eps: float = 1e-12) -> torch.Tensor:
    return v / (torch.linalg.norm(v, dim=-1, keepdim=True) + eps)


def embed_segment_videomae(
    frames_chw_uint8: List[np.ndarray],
    model_name: str = "MCG-NJU/videomae-base",
    device: str | None = None,
) -> np.ndarray:
    """
    frames_chw_uint8: list of frames shaped (3, H, W), dtype uint8, values 0..255.
    Returns: embedding vector (hidden_size,) as float32 numpy, L2-normalized.
    """
    if not frames_chw_uint8:
        raise ValueError("No frames provided for embedding.")

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    bundle = _get_videomae_bundle(model_name, device)
    processor = bundle.processor
    model = bundle.model

    # HF processor accepts a list of frames as a "video" input. :contentReference[oaicite:3]{index=3}
    inputs = processor(frames_chw_uint8, return_tensors="pt")
    pixel_values = inputs.pixel_values  # commonly [1, T, 3, 224, 224] (processor-dependent)

    if pixel_values.ndim == 4:
        # (T, C, H, W) -> (1, T, C, H, W)
        pixel_values = pixel_values.unsqueeze(0)

    pixel_values = pixel_values.to(bundle.device)

    with torch.no_grad():
        outputs = model(pixel_values=pixel_values)
        # outputs.last_hidden_state: (B, seq_len, hidden) :contentReference[oaicite:4]{index=4}
        last = outputs.last_hidden_state
        pooled = last.mean(dim=1)  # (B, hidden)
        pooled = _l2_normalize(pooled).squeeze(0)

    return pooled.detach().cpu().to(torch.float32).numpy()
