from __future__ import annotations

import io
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from .wav2vec2_embedder import (
    embed_segments_wav2vec2,
    wav2vec2_available,
    wav2vec2_import_error,
)


@dataclass
class AudioShiftConfig:
    target_sr: int = 16000

    # segmentation
    window_sec: float = 4.0
    hop_sec: float = 2.0

    # baseline: first N seconds (within same file)
    baseline_sec: float = 20.0

    # pitch detection bounds (Hz)
    fmin: float = 70.0
    fmax: float = 350.0

    # silence threshold for pause ratio (on float audio in [-1,1])
    silence_abs_threshold: float = 0.01

    # numeric stability
    eps: float = 1e-8

    # safety limits (to avoid huge CPU runs)
    max_audio_sec: float = 180.0  # truncate beyond this


def _to_mono(x: np.ndarray) -> np.ndarray:
    if x.ndim == 1:
        return x.astype(np.float32, copy=False)
    return x.mean(axis=1).astype(np.float32, copy=False)


def _read_wav_bytes(file_bytes: bytes) -> Tuple[np.ndarray, int]:
    buf = io.BytesIO(file_bytes)
    x, sr = sf.read(buf, dtype="float32", always_2d=True)
    x = _to_mono(x)
    return x, int(sr)


def _resample(x: np.ndarray, sr: int, target_sr: int) -> Tuple[np.ndarray, int]:
    if sr == target_sr:
        return x, sr
    g = math.gcd(sr, target_sr)
    up = target_sr // g
    down = sr // g
    y = resample_poly(x, up, down).astype(np.float32, copy=False)
    return y, target_sr


def _rms(x: np.ndarray, eps: float) -> float:
    return float(np.sqrt(np.mean(x * x) + eps))


def _zcr(x: np.ndarray) -> float:
    s = np.sign(x)
    s[s == 0] = 1
    return float(np.mean(s[1:] != s[:-1]))


def _pause_ratio(x: np.ndarray, thr: float) -> float:
    return float(np.mean(np.abs(x) < thr))


def _pitch_autocorr(x: np.ndarray, sr: int, fmin: float, fmax: float, eps: float) -> float:
    if len(x) < int(0.05 * sr):
        return 0.0

    x = x - float(np.mean(x))
    w = np.hanning(len(x)).astype(np.float32)
    xw = x * w

    ac = np.correlate(xw, xw, mode="full")[len(xw) - 1 :]
    ac0 = float(ac[0]) + eps
    ac = ac / ac0

    lag_min = int(sr / fmax)
    lag_max = int(sr / fmin)
    lag_max = min(lag_max, len(ac) - 1)

    if lag_max <= lag_min + 2:
        return 0.0

    seg = ac[lag_min:lag_max]
    peak_i = int(np.argmax(seg)) + lag_min
    peak_v = float(ac[peak_i])

    if peak_v < 0.25:
        return 0.0

    f0 = sr / float(peak_i)
    return float(f0)


def _segments(x: np.ndarray, sr: int, window_sec: float, hop_sec: float) -> List[Tuple[int, int]]:
    win = max(1, int(window_sec * sr))
    hop = max(1, int(hop_sec * sr))
    out = []
    i = 0
    while i + win <= len(x):
        out.append((i, i + win))
        i += hop
    if not out and len(x) > 0:
        out.append((0, len(x)))
    return out


def _cos_sim_to_unit_centroid(mat_unit: np.ndarray, centroid_unit: np.ndarray) -> np.ndarray:
    # both assumed L2-normalized
    return mat_unit @ centroid_unit


def analyze_audio_shift_bytes(
    file_bytes: bytes,
    cfg: AudioShiftConfig | None = None,
    use_embeddings: bool = True,
    embedding_model: str = "facebook/wav2vec2-base",
    embed_batch_size: int = 8,
    combine_alpha: float = 0.5,  # alpha*prosody + (1-alpha)*embedding
) -> Dict[str, Any]:
    """
    Baseline-relative delivery shift:
      - Prosody proxy anomaly (RMS/ZCR/Pause/Pitch z-scores vs baseline)
      - Wav2Vec2 embedding-distance anomaly (1 - cosine sim to baseline centroid)
      - Fused anomaly score

    Not medical. Not deception detection. Not truth verification.
    """
    cfg = cfg or AudioShiftConfig()
    warnings: List[str] = []

    x, sr = _read_wav_bytes(file_bytes)
    x, sr = _resample(x, sr, cfg.target_sr)

    dur_sec = len(x) / float(sr + 1e-9)
    if dur_sec > cfg.max_audio_sec:
        max_n = int(cfg.max_audio_sec * sr)
        x = x[:max_n]
        warnings.append(f"Audio truncated to {cfg.max_audio_sec:.0f}s for CPU safety.")

    segs = _segments(x, sr, cfg.window_sec, cfg.hop_sec)

    baseline_end = int(cfg.baseline_sec * sr)
    baseline_idx = [k for k, (a, b) in enumerate(segs) if b <= baseline_end]
    if len(baseline_idx) < 2:
        baseline_idx = list(range(min(2, len(segs))))
        warnings.append("Baseline too short; using first available segments as baseline.")

    # -------- Prosody features per segment --------
    feats = []
    for (a, b) in segs:
        s = x[a:b]
        feats.append(
            {
                "startMs": int(1000 * a / sr),
                "endMs": int(1000 * b / sr),
                "rms": _rms(s, cfg.eps),
                "zcr": _zcr(s),
                "pauseRatio": _pause_ratio(s, cfg.silence_abs_threshold),
                "pitchHz": _pitch_autocorr(s, sr, cfg.fmin, cfg.fmax, cfg.eps),
            }
        )

    def stat(key: str, ignore_zeros: bool = False):
        vals = []
        for i in baseline_idx:
            v = float(feats[i][key])
            if ignore_zeros and abs(v) < 1e-12:
                continue
            vals.append(v)
        if len(vals) < 2:
            vals = []
            for f in feats:
                v = float(f[key])
                if ignore_zeros and abs(v) < 1e-12:
                    continue
                vals.append(v)
        arr = np.array(vals, dtype=np.float32) if vals else np.array([0.0], dtype=np.float32)
        mu = float(arr.mean())
        sd = float(arr.std(ddof=0)) + cfg.eps
        return mu, sd

    mu_rms, sd_rms = stat("rms")
    mu_zcr, sd_zcr = stat("zcr")
    mu_pause, sd_pause = stat("pauseRatio")
    mu_pitch, sd_pitch = stat("pitchHz", ignore_zeros=True)

    prosody_anoms: List[float] = []
    z_prosody_list: List[dict] = []

    for f in feats:
        z = {}
        z["rms"] = (f["rms"] - mu_rms) / sd_rms
        z["zcr"] = (f["zcr"] - mu_zcr) / sd_zcr
        z["pauseRatio"] = (f["pauseRatio"] - mu_pause) / sd_pause
        if f["pitchHz"] > 0.0:
            z["pitchHz"] = (f["pitchHz"] - mu_pitch) / sd_pitch
        else:
            z["pitchHz"] = None

        z_abs = [abs(float(z["rms"])), abs(float(z["zcr"])), abs(float(z["pauseRatio"]))]
        if z["pitchHz"] is not None:
            z_abs.append(abs(float(z["pitchHz"])))

        seg_anom = float(np.mean(z_abs)) if z_abs else 0.0
        prosody_anoms.append(seg_anom)
        z_prosody_list.append(z)

    # -------- Wav2Vec2 embedding anomaly --------
    embedding_used = False
    embed_meta = None
    embed_mu = None
    embed_sd = None
    embed_dist = [None] * len(segs)  # 1 - cosine sim to baseline centroid
    embed_z = [None] * len(segs)
    embed_anom = [0.0] * len(segs)

    if use_embeddings:
        if not wav2vec2_available():
            warnings.append(f"wav2vec2 disabled: {wav2vec2_import_error()}")
        else:
            waves = [x[a:b] for (a, b) in segs]
            mat, meta = embed_segments_wav2vec2(
                waves, sr=sr, model_name=embedding_model, batch_size=embed_batch_size
            )
            embed_meta = meta

            # baseline centroid (unit)
            base = mat[baseline_idx, :]
            centroid = base.mean(axis=0).astype(np.float32, copy=False)
            centroid = centroid / (np.linalg.norm(centroid) + cfg.eps)

            sims = _cos_sim_to_unit_centroid(mat, centroid)  # (N,)
            dists = (1.0 - sims).astype(np.float32, copy=False)  # higher = further from baseline

            # baseline dist stats
            base_d = dists[baseline_idx]
            embed_mu = float(base_d.mean())
            embed_sd = float(base_d.std(ddof=0)) + cfg.eps

            for i in range(len(segs)):
                dz = (float(dists[i]) - embed_mu) / embed_sd
                embed_dist[i] = float(dists[i])
                embed_z[i] = float(dz)
                embed_anom[i] = abs(float(dz))

            embedding_used = True

    # -------- Fuse scores --------
    alpha = float(combine_alpha)
    alpha = max(0.0, min(1.0, alpha))

    combined = []
    for i in range(len(segs)):
        c = alpha * float(prosody_anoms[i]) + (1.0 - alpha) * float(embed_anom[i])
        combined.append(float(c))

    overall = float(np.mean(combined)) if combined else 0.0

    thr = 1.25
    spikes = [i for i, a in enumerate(combined) if a >= thr]

        # ---- Human-friendly summary scores ----
    # Map "overall anomaly" (unbounded-ish) -> 0..100 consistency score
    # Higher anomaly => lower consistency. Exponential mapping avoids hard clipping artifacts.
    k_decay = 0.7
    delivery_consistency = 100.0 * math.exp(-k_decay * float(overall))
    delivery_consistency = max(0.0, min(100.0, delivery_consistency))

    spike_rate = (len(spikes) / float(len(combined))) if combined else 0.0
    peak_anomaly = float(max(combined)) if combined else 0.0

    # Driver attribution (which branch contributes more on average after fusion weights)
    mean_prosody = float(np.mean(prosody_anoms)) if prosody_anoms else 0.0
    mean_embed = float(np.mean(embed_anom)) if embedding_used else 0.0
    prosody_part = alpha * mean_prosody
    embed_part = (1.0 - alpha) * mean_embed
    driver = "prosody" if prosody_part >= embed_part else "embeddings"
    driver_share = (max(prosody_part, embed_part) / (prosody_part + embed_part + cfg.eps))

    # Percentile vs baseline (where each segment sits relative to baseline distribution)
    base_vals = np.array([combined[i] for i in baseline_idx], dtype=np.float32) if baseline_idx else np.array([], dtype=np.float32)

    def pct_vs_baseline(v: float) -> Optional[float]:
        if base_vals.size == 0:
            return None
        return float(np.mean(base_vals <= float(v)) * 100.0)


    # -------- Build output --------
    segments_out = []
    for i, f in enumerate(feats):
        z = z_prosody_list[i]
        segments_out.append(
            {
                "startMs": f["startMs"],
                "endMs": f["endMs"],
                "features": {
                    "rms": round(float(f["rms"]), 6),
                    "zcr": round(float(f["zcr"]), 6),
                    "pauseRatio": round(float(f["pauseRatio"]), 6),
                    "pitchHz": round(float(f["pitchHz"]), 2),
                    "embeddingDistance": round(float(embed_dist[i]), 6) if embed_dist[i] is not None else None,
                },
                "z": {
                    "rms": round(float(z["rms"]), 4),
                    "zcr": round(float(z["zcr"]), 4),
                    "pauseRatio": round(float(z["pauseRatio"]), 4),
                    "pitchHz": round(float(z["pitchHz"]), 4) if z["pitchHz"] is not None else None,
                    "embeddingDistance": round(float(embed_z[i]), 4) if embed_z[i] is not None else None,
                },
                "prosodyAnomaly": round(float(prosody_anoms[i]), 4),
                "embeddingAnomaly": round(float(embed_anom[i]), 4) if embedding_used else 0.0,
                "segmentAnomaly": round(float(combined[i]), 4),  # fused anomaly (primary)
                "percentileVsBaseline": round(float(pct_vs_baseline(combined[i])), 1) if pct_vs_baseline(combined[i]) is not None else None,
            }
        )

    return {
        "ok": True,
        "mode": "audio_prosody_plus_wav2vec2_baseline_shift",
        "sr": sr,
        "config": {
            "windowSec": cfg.window_sec,
            "hopSec": cfg.hop_sec,
            "baselineSec": cfg.baseline_sec,
            "pitchHzRange": [cfg.fmin, cfg.fmax],
            "maxAudioSec": cfg.max_audio_sec,
            "useEmbeddings": bool(use_embeddings),
            "embeddingModel": embedding_model,
            "embedBatchSize": embed_batch_size,
            "combineAlpha": alpha,
        },
        "baseline": {
            "rms": {"mean": round(mu_rms, 6), "std": round(sd_rms, 6)},
            "zcr": {"mean": round(mu_zcr, 6), "std": round(sd_zcr, 6)},
            "pauseRatio": {"mean": round(mu_pause, 6), "std": round(sd_pause, 6)},
            "pitchHz": {"mean": round(mu_pitch, 2), "std": round(sd_pitch, 2)},
            "embeddingDistance": {
                "mean": round(float(embed_mu), 6) if embed_mu is not None else None,
                "std": round(float(embed_sd), 6) if embed_sd is not None else None,
                "model": embed_meta["modelName"] if embed_meta else None,
                "dim": embed_meta["dim"] if embed_meta else None,
            },
            "baselineSegments": baseline_idx,
        },
        "summary": {
            "segments": len(segments_out),
            "overallAnomaly": round(overall, 4),
            "spikeThreshold": thr,
            "spikeSegments": spikes,
            "spikeCount": len(spikes),
            "embeddingUsed": bool(embedding_used),
            "deliveryConsistencyScore": round(float(delivery_consistency), 1),
            "spikeRate": round(float(spike_rate), 3),
            "peakAnomaly": round(float(peak_anomaly), 4),
            "driver": driver,
            "driverShare": round(float(driver_share), 3),
            "decayK": k_decay,
        },
        "segments": segments_out,
        "warnings": warnings,
        "disclaimer": "Baseline-relative delivery shift signals (prosody + wav2vec2 embeddings). Not medical, not deception detection, not truth verification.",
    }
