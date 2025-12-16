from __future__ import annotations

import math
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import numpy as np

from .videomae_embedder import embed_segment_videomae


@dataclass
class Segment:
    t0: float
    t1: float
    frame_indices: List[int]


def _safe_float(x: Any, default: float) -> float:
    try:
        return float(x)
    except Exception:
        return default


def _cosine_sim(a: np.ndarray, b: np.ndarray, eps: float = 1e-12) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na < eps or nb < eps:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _zscore_abs(x: float, mu: float, sigma: float, eps: float = 1e-8) -> float:
    return abs((x - mu) / (sigma + eps))


def _percentile_against_baseline(x: float, baseline_vals: np.ndarray) -> float:
    if baseline_vals.size == 0:
        return 0.0
    return float((baseline_vals <= x).mean() * 100.0)


def _uniform_pick_indices(n: int, k: int) -> List[int]:
    if n <= 0:
        return [0] * k
    if n == 1:
        return [0] * k
    xs = np.linspace(0, n - 1, k)
    return [int(round(v)) for v in xs]


def _to_chw_uint8(rgb_hwc: np.ndarray) -> np.ndarray:
    # rgb_hwc: (H, W, 3) uint8 -> (3, H, W) uint8
    if rgb_hwc.ndim != 3 or rgb_hwc.shape[-1] != 3:
        raise ValueError(f"Expected RGB HWC frame, got shape={rgb_hwc.shape}")
    return np.transpose(rgb_hwc, (2, 0, 1)).astype(np.uint8, copy=False)


def decode_video_to_frames(
    file_path: str,
    target_fps: float = 8.0,
    max_seconds: float = 300.0,
    max_frames: int = 4000,
) -> Tuple[List[np.ndarray], List[float], Dict[str, Any]]:
    """
    Decodes video into RGB frames (HWC uint8) sampled down to ~target_fps.
    Uses PyAV (FFmpeg binding). :contentReference[oaicite:5]{index=5}
    """
    try:
        import av  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "PyAV is not installed or failed to import. Install with: pip install av"
        ) from e

    container = av.open(file_path)
    stream = container.streams.video[0]

    avg_rate = stream.average_rate
    src_fps = _safe_float(avg_rate, 30.0) if avg_rate is not None else 30.0
    src_fps = max(1.0, src_fps)

    # Downsample frames by simple stride.
    stride = max(1, int(round(src_fps / max(0.1, target_fps))))

    frames: List[np.ndarray] = []
    times: List[float] = []

    i = 0
    kept = 0

    time_base = float(stream.time_base) if stream.time_base is not None else (1.0 / src_fps)

    for frame in container.decode(video=0):
        # Timestamp in seconds if available
        if frame.pts is not None:
            t = float(frame.pts * time_base)
        else:
            t = i / src_fps

        if t > max_seconds:
            break

        if i % stride == 0:
            rgb = frame.to_rgb().to_ndarray()  # (H, W, 3) uint8
            frames.append(rgb)
            times.append(t)
            kept += 1

            if kept >= max_frames:
                break

        i += 1

    container.close()

    meta = {
        "src_fps": src_fps,
        "target_fps": target_fps,
        "stride": stride,
        "decoded_frames": i,
        "kept_frames": kept,
        "duration_s_est": float(times[-1]) if times else 0.0,
    }
    return frames, times, meta


def build_segments(
    times: List[float],
    window_sec: float,
    hop_sec: float,
) -> List[Segment]:
    if not times:
        return []

    duration = float(times[-1])
    segs: List[Segment] = []

    t0 = 0.0
    while t0 <= duration:
        t1 = t0 + window_sec
        idxs = [i for i, t in enumerate(times) if (t >= t0 and t < t1)]
        # If no frames in window, try grabbing nearest frame to midpoint (keeps timeline intact).
        if not idxs:
            mid = (t0 + t1) / 2.0
            nearest = int(np.argmin(np.abs(np.array(times) - mid)))
            idxs = [nearest]
        segs.append(Segment(t0=t0, t1=t1, frame_indices=idxs))
        t0 += hop_sec

    return segs


def analyze_video_shift(
    file_path: str,
    model_name: str = "MCG-NJU/videomae-base",
    frames_per_segment: int = 16,
    target_fps: float = 8.0,
    window_sec: float = 4.0,
    hop_sec: float = 2.0,
    baseline_sec: float = 20.0,
    thr: float = 1.25,
    max_seconds: float = 300.0,
) -> Dict[str, Any]:
    frames_hwc, times, decode_meta = decode_video_to_frames(
        file_path=file_path,
        target_fps=target_fps,
        max_seconds=max_seconds,
    )

    if len(frames_hwc) < 2:
        return {
            "ok": False,
            "error": "Too few decodable frames. Try a different video or ensure it contains a video track.",
            "meta": decode_meta,
        }

    segments = build_segments(times, window_sec=window_sec, hop_sec=hop_sec)
    if not segments:
        return {"ok": False, "error": "Could not create segments from frames.", "meta": decode_meta}

    # Choose baseline segments by time coverage (at least 2)
    baseline_idxs = [i for i, s in enumerate(segments) if s.t1 <= baseline_sec]
    if len(baseline_idxs) < 2:
        baseline_idxs = list(range(min(2, len(segments))))

    # Compute embeddings per segment
    seg_embeddings: List[np.ndarray] = []
    seg_debug: List[Dict[str, Any]] = []

    for s in segments:
        seg_frames = [frames_hwc[i] for i in s.frame_indices]
        pick = _uniform_pick_indices(len(seg_frames), frames_per_segment)
        picked_frames = [_to_chw_uint8(seg_frames[j]) for j in pick]

        emb = embed_segment_videomae(
            picked_frames,
            model_name=model_name,
        )
        seg_embeddings.append(emb)

        seg_debug.append(
            {
                "t0": s.t0,
                "t1": s.t1,
                "frames_available": len(seg_frames),
                "frames_used": frames_per_segment,
                "picked_local_indices": pick,
            }
        )

    E = np.stack(seg_embeddings, axis=0)  # (S, D)

    # Baseline centroid
    Eb = E[baseline_idxs]
    centroid = Eb.mean(axis=0)
    c_norm = np.linalg.norm(centroid)
    if c_norm > 1e-12:
        centroid = centroid / c_norm

    # Baseline distance distribution
    baseline_dists = []
    for i in baseline_idxs:
        sim = _cosine_sim(E[i], centroid)
        dist = 1.0 - sim
        baseline_dists.append(dist)
    baseline_dists = np.array(baseline_dists, dtype=np.float32)

    mu = float(baseline_dists.mean()) if baseline_dists.size else 0.0
    sigma = float(baseline_dists.std()) if baseline_dists.size else 1.0

    # Segment anomalies
    results = []
    anomalies = []

    for i, s in enumerate(segments):
        sim = _cosine_sim(E[i], centroid)
        dist = 1.0 - sim
        z = _zscore_abs(dist, mu, sigma)
        anomalies.append(z)

        results.append(
            {
                "i": i,
                "t0": round(s.t0, 3),
                "t1": round(s.t1, 3),
                "cosineSimToBaseline": sim,
                "distToBaseline": dist,
                "z": z,
            }
        )

    anomalies_np = np.array(anomalies, dtype=np.float32)

    # For percentile, compare anomalies to baseline anomalies (in z-space)
    baseline_anoms = anomalies_np[baseline_idxs] if len(baseline_idxs) else np.array([], dtype=np.float32)

    spike_flags = (anomalies_np > thr).tolist()
    spike_count = int(sum(spike_flags))
    spike_rate = float(spike_count / max(1, len(spike_flags)))
    peak_anom = float(anomalies_np.max()) if anomalies_np.size else 0.0
    overall_anom = float(anomalies_np.mean()) if anomalies_np.size else 0.0

    # Score mapping (same philosophy as your audio module)
    k = 0.7
    visual_score = float(100.0 * math.exp(-k * overall_anom))
    visual_score = max(0.0, min(100.0, visual_score))

    # Attach explainability extras
    for r in results:
        z = float(r["z"])
        r["isSpike"] = bool(z > thr)
        r["percentileVsBaseline"] = _percentile_against_baseline(z, baseline_anoms)
        r["debug"] = seg_debug[int(r["i"])]

    payload = {
        "ok": True,
        "model": {
            "name": model_name,
            "frames_per_segment": frames_per_segment,
            "target_fps": target_fps,
        },
        "params": {
            "window_sec": window_sec,
            "hop_sec": hop_sec,
            "baseline_sec": baseline_sec,
            "thr": thr,
            "max_seconds": max_seconds,
        },
        "meta": decode_meta,
        "baseline": {
            "segment_indices": baseline_idxs,
            "dist_mu": mu,
            "dist_sigma": sigma,
        },
        "summary": {
            "visualConsistencyScore": round(visual_score, 2),
            "overallAnomaly": round(overall_anom, 4),
            "spikeRate": round(spike_rate, 4),
            "spikeCount": spike_count,
            "peakAnomaly": round(peak_anom, 4),
            "totalSegments": len(results),
        },
        "segments": results,
        "disclaimer": "PersonaLens visual shift surfaces baseline-relative delivery/anomaly signals. It is not a lie detector, not medical, and does not verify truth.",
    }
    return payload
