"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function msToClock(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function scoreTheme(score) {
  if (score >= 80)
    return {
      label: "Stable delivery",
      sub: "Low baseline drift across segments",
      bar: "bg-emerald-400/80",
      ring: "ring-emerald-400/15",
      text: "text-emerald-200",
    };
  if (score >= 55)
    return {
      label: "Mixed stability",
      sub: "Some drift spikes relative to baseline",
      bar: "bg-yellow-300/80",
      ring: "ring-yellow-300/15",
      text: "text-yellow-200",
    };
  return {
    label: "Highly variable",
    sub: "Frequent or strong delivery shifts vs baseline",
    bar: "bg-red-400/80",
    ring: "ring-red-400/15",
    text: "text-red-200",
  };
}

function Pill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
      <span className="text-white/60">{label}: </span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function BarRow({ value, max, hot, label }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0 text-[11px] text-white/55">{label}</div>
      <div className="h-2 w-full rounded-full bg-white/10">
        <div
          className={`h-2 rounded-full ${hot ? "bg-red-400/80" : "bg-white/60"}`}
          style={{ width: `${w}%` }}
        />
      </div>
      <div className="w-14 shrink-0 text-right text-[11px] text-white/60">{Number(value).toFixed(3)}</div>
    </div>
  );
}

function BigBar({ label, value, suffix = "", barClass = "bg-white/60" }) {
  const w = clamp(Number(value) || 0, 0, 100);
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-xs text-white/70">
          <span className="text-white">{w.toFixed(1)}</span>
          {suffix}
        </div>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-white/10">
        <div className={`h-3 rounded-full ${barClass}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function ScoreHero({ result }) {
  const summary = result?.summary || {};
  const score = Number(summary.deliveryConsistencyScore ?? 0);
  const overall = summary.overallAnomaly ?? "—";
  const spikeCount = summary.spikeCount ?? "—";

  // spikeRate in API is a fraction (0..1). Convert to percentage.
  const spikeRatePct = summary.spikeRate != null ? Number(summary.spikeRate) * 100 : null;

  // peak anomaly: take from summary if present, else compute from segments
  const peak =
    summary.peakAnomaly != null
      ? Number(summary.peakAnomaly)
      : Math.max(0, ...(result?.segments || []).map((s) => Number(s.segmentAnomaly || 0)));

  // Peak anomaly isn't 0..100 by nature; map it for UI (cap at 3.0 -> 100%)
  const peakVisual = clamp((peak / 3.0) * 100, 0, 100);

  const driver = summary.driver ?? "—";
  const driverSharePct =
    summary.driverShare != null ? clamp(Number(summary.driverShare) * 100, 0, 100) : null;

  const theme = scoreTheme(score);

  return (
    <div className={`rounded-2xl border border-white/10 bg-black/30 p-4 ring-1 ${theme.ring}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-white/60">Delivery Consistency Score</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-5xl font-semibold tracking-tight text-white">{score.toFixed(1)}</div>
            <div className="pb-1 text-sm text-white/55">/ 100</div>
          </div>
          <div className={`mt-1 text-sm font-medium ${theme.text}`}>{theme.label}</div>
          <div className="mt-1 text-xs text-white/55">{theme.sub}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Pill label="OverallAnom" value={overall} />
            <Pill label="Spikes" value={spikeCount} />
            <Pill label="Driver" value={driver} />
          </div>
          <div className="text-[11px] text-white/45">Baseline-relative; not truth or deception.</div>
        </div>
      </div>

      <div className="mt-4">
        <BigBar label="Consistency" value={score} suffix="%" barClass={theme.bar} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <BigBar
            label="Spike rate"
            value={spikeRatePct == null ? 0 : spikeRatePct}
            suffix="%"
            barClass={spikeRatePct != null && spikeRatePct >= 30 ? "bg-red-400/70" : "bg-white/60"}
          />
          <div className="mt-2 text-[11px] text-white/45">Percent of segments above the spike threshold.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <BigBar
            label="Peak intensity"
            value={peakVisual}
            suffix="%"
            barClass={peakVisual >= 70 ? "bg-red-400/70" : "bg-white/60"}
          />
          <div className="mt-2 text-[11px] text-white/45">Visual scale (peak anomaly mapped, capped at 3.0).</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <BigBar
            label={`Driver share (${driver})`}
            value={driverSharePct == null ? 0 : driverSharePct}
            suffix="%"
            barClass={driver === "embeddings" ? "bg-indigo-300/70" : "bg-emerald-300/70"}
          />
          <div className="mt-2 text-[11px] text-white/45">Which branch dominated the fused score on average.</div>
        </div>
      </div>
    </div>
  );
}

export default function AudioShiftAnalyzer() {
  const [file, setFile] = useState(null);

  const [useEmbeddings, setUseEmbeddings] = useState(true);
  const [alpha, setAlpha] = useState(0.5);
  const [embeddingModel, setEmbeddingModel] = useState("facebook/wav2vec2-base");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [selectedIdx, setSelectedIdx] = useState(null);

  const canRun = !!file && !loading;

  const segments = result?.segments || [];
  const anomalyMax = useMemo(() => {
    const vals = segments.map((s) => Number(s.segmentAnomaly || 0));
    return vals.length ? Math.max(...vals, 1e-6) : 1;
  }, [segments]);

  const spikes = useMemo(() => {
    const spikeSet = new Set(result?.summary?.spikeSegments || []);
    return spikeSet;
  }, [result]);

  async function run() {
    setError("");
    setResult(null);
    setSelectedIdx(null);

    if (!file) {
      setError("Please upload a WAV file.");
      return;
    }

    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".wav")) {
      setError("This MVP expects a .wav file. Convert your video/audio to WAV and retry.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const url =
        `${API_BASE}/analyze/audio/shift` +
        `?use_embeddings=${encodeURIComponent(String(useEmbeddings))}` +
        `&embedding_model=${encodeURIComponent(embeddingModel)}` +
        `&alpha=${encodeURIComponent(String(alpha))}`;

      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`API ${res.status}: ${msg || "Request failed"}`);
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Audio shift analysis failed.");

      setResult(data);

      saveLastRun("audio", {
        meta: { generatedAt: new Date().toISOString(), apiBase: API_BASE },
        input: {
          fileName: file.name,
          useEmbeddings,
          embeddingModel,
          alpha,
        },
        output: data,
      });
    } catch (e) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function downloadRunJSON() {
    if (!result?.ok) return;
    downloadJSON("personalens-audio-shift-report", {
      meta: { generatedAt: new Date().toISOString(), apiBase: API_BASE },
      input: {
        fileName: file?.name || null,
        useEmbeddings,
        embeddingModel,
        alpha,
      },
      output: result,
    });
  }

  const selected = selectedIdx != null ? segments[selectedIdx] : null;

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
          <p className="text-sm leading-relaxed text-white/70">
            Delivery Shift (Audio): baseline-relative anomaly over time using prosody proxies and optional wav2vec2
            embeddings. This is not medical, not deception detection, not truth verification.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: controls */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-medium text-white/70">Upload WAV</div>
            <input
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 p-2 text-sm text-white/75 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
            />
            <div className="mt-2 text-[11px] text-white/45">
              MVP expects WAV. If you have mp4/webm, convert to WAV first (we’ll add ffmpeg extraction later).
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-white/70">Use wav2vec2 embeddings</div>
                <button
                  onClick={() => setUseEmbeddings((v) => !v)}
                  className="inline-flex h-7 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  {useEmbeddings ? "ON" : "OFF"}
                </button>
              </div>

              <div className="mt-3">
                <div className="text-[11px] text-white/60">Embedding model</div>
                <select
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                  disabled={!useEmbeddings}
                  className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20 disabled:opacity-50"
                >
                  <option value="facebook/wav2vec2-base">facebook/wav2vec2-base</option>
                  <option value="facebook/wav2vec2-large">facebook/wav2vec2-large</option>
                </select>
                <div className="mt-2 text-[11px] text-white/45">Large is heavier on CPU. Base is recommended.</div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/60">Fusion alpha (prosody weight)</div>
                  <div className="text-[11px] text-white/60">{alpha.toFixed(2)}</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="mt-1 text-[11px] text-white/45">alpha=1.0 prosody only • alpha=0.0 embeddings only</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">API: {API_BASE}</div>
              <button
                onClick={run}
                disabled={!canRun}
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Analyze Audio"}
              </button>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            ) : null}

            {result?.warnings?.length ? (
              <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                {result.warnings.map((w, i) => (
                  <div key={i}>• {w}</div>
                ))}
              </div>
            ) : null}

            {result?.ok ? (
              <div className="mt-4">
                <button
                  onClick={downloadRunJSON}
                  className="inline-flex h-9 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Download JSON Report
                </button>
              </div>
            ) : null}
          </div>

          {/* Right: results */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            {result?.ok ? (
              <ScoreHero result={result} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs font-medium text-white/70">Timeline</div>
                <div className="mt-1 text-xs text-white/55">
                  Run analysis to see the consistency score and segment spikes.
                </div>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              {segments.length ? (
                <div className="flex flex-col gap-2">
                  {segments.map((s, i) => {
                    const hot = spikes.has(i);
                    const label = `${msToClock(s.startMs)}–${msToClock(s.endMs)}`;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedIdx(i)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          selectedIdx === i
                            ? "border-white/25 bg-white/10"
                            : hot
                            ? "border-red-500/35 bg-red-500/10 hover:bg-red-500/15"
                            : "border-white/10 bg-black/20 hover:bg-white/5"
                        }`}
                      >
                        <BarRow value={Number(s.segmentAnomaly || 0)} max={anomalyMax} hot={hot} label={label} />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-[11px] text-white/55">
                            prosody {Number(s.prosodyAnomaly || 0).toFixed(3)}
                          </span>
                          <span className="text-[11px] text-white/55">
                            embed {Number(s.embeddingAnomaly || 0).toFixed(3)}
                          </span>
                          {s.percentileVsBaseline != null ? (
                            <span className="text-[11px] text-white/55">
                              pct {Number(s.percentileVsBaseline).toFixed(1)}
                            </span>
                          ) : null}
                          {hot ? <span className="text-[11px] text-red-200">spike</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/55">No timeline yet.</div>
              )}
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-white/70">Segment details</div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                {selected ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/70">
                        {msToClock(selected.startMs)}–{msToClock(selected.endMs)}
                      </div>
                      <div className="text-xs text-white/55">
                        anomaly{" "}
                        <span className="text-white">{Number(selected.segmentAnomaly || 0).toFixed(3)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill label="RMS" value={selected.features?.rms ?? "—"} />
                      <Pill label="ZCR" value={selected.features?.zcr ?? "—"} />
                      <Pill label="Pause" value={selected.features?.pauseRatio ?? "—"} />
                      <Pill label="PitchHz" value={selected.features?.pitchHz ?? "—"} />
                      <Pill label="EmbDist" value={selected.features?.embeddingDistance ?? "—"} />
                      <Pill label="PctVsBase" value={selected.percentileVsBaseline ?? "—"} />
                    </div>

                    <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
{JSON.stringify(selected, null, 2)}
                    </pre>
                  </>
                ) : (
                  <div className="text-xs text-white/55">Click any segment to inspect it.</div>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-white/70">Notes</div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                This highlights delivery shifts relative to the baseline window inside the same file. Spikes can be caused
                by noise, mic distance, clipping, or genuine delivery changes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
