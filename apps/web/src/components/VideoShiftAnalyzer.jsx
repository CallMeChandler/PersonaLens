"use client";

import React, { useEffect, useMemo, useState } from "react";
import { saveLastRun } from "@/lib/reportVault";
import { downloadJSON } from "@/lib/reportUtils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function pct(x) {
  return `${Math.round(x * 100)}%`;
}
function msToClock(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function Pill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
      <span className="text-white/55">{label}: </span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}

export default function VideoShiftAnalyzer() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [modelName, setModelName] = useState("MCG-NJU/videomae-base");
  const [framesPerSegment, setFramesPerSegment] = useState(16);
  const [targetFps, setTargetFps] = useState(8);
  const [windowSec, setWindowSec] = useState(4);
  const [hopSec, setHopSec] = useState(2);
  const [baselineSec, setBaselineSec] = useState(20);
  const [thr, setThr] = useState(1.25);
  const [maxSeconds, setMaxSeconds] = useState(300);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const summary = data?.summary;
  const segments = data?.segments || [];

  const score = summary ? summary.visualConsistencyScore : null;
  const score01 = score == null ? 0 : clamp01(score / 100);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function run() {
    setErr("");
    setData(null);
    setSelectedIdx(null);

    if (!file) {
      setErr("Please upload a video file first.");
      return;
    }

    setLoading(true);
    try {
      const qs = new URLSearchParams({
        model_name: modelName,
        frames_per_segment: String(framesPerSegment),
        target_fps: String(targetFps),
        window_sec: String(windowSec),
        hop_sec: String(hopSec),
        baseline_sec: String(baselineSec),
        thr: String(thr),
        max_seconds: String(maxSeconds),
      });

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE}/analyze/video/shift?${qs.toString()}`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      setData(json);
      saveLastRun("video_shift", {
        ts: Date.now(),
        input: {
          name: file.name,
          size: file.size,
          modelName,
          framesPerSegment,
          targetFps,
          windowSec,
          hopSec,
          baselineSec,
          thr,
          maxSeconds,
        },
        output: json,
      });
    } catch (e) {
      setErr(e?.message || "Failed to analyze video.");
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => {
    if (selectedIdx == null) return null;
    return segments[selectedIdx] || null;
  }, [segments, selectedIdx]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Left controls */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-white/90">Visual Shift (Video)</div>
          <div className="text-xs text-white/60">
            Baseline-relative visual delivery consistency using a video Transformer (VideoMAE). Not deception detection.
          </div>
        </div>

        <label className="block text-xs text-white/70 mb-2">Upload video</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
        />

        {/* Video preview */}
        {previewUrl ? (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 text-xs text-white/60">Preview</div>
            <video
              src={previewUrl}
              controls
              playsInline
              className="w-full rounded-xl"
            />
            <div className="mt-2 text-[11px] text-white/55">
              {file?.name} • {(file.size / (1024 * 1024)).toFixed(1)} MB
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">Model</label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
            >
              <option value="MCG-NJU/videomae-base">MCG-NJU/videomae-base</option>
              <option value="MCG-NJU/videomae-base-finetuned-kinetics">
                MCG-NJU/videomae-base-finetuned-kinetics
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">Frames / segment</label>
              <input
                type="number"
                min={4}
                max={32}
                value={framesPerSegment}
                onChange={(e) => setFramesPerSegment(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Target FPS</label>
              <input
                type="number"
                min={1}
                max={30}
                value={targetFps}
                onChange={(e) => setTargetFps(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">Window (sec)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={windowSec}
                onChange={(e) => setWindowSec(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Hop (sec)</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={hopSec}
                onChange={(e) => setHopSec(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/70 mb-1">Baseline (sec)</label>
              <input
                type="number"
                min={4}
                step={1}
                value={baselineSec}
                onChange={(e) => setBaselineSec(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Spike thr (z)</label>
              <input
                type="number"
                min={0.5}
                step={0.05}
                value={thr}
                onChange={(e) => setThr(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
            <div>
              <label className="block text-xs text-white/70 mb-1">Max seconds</label>
              <input
                type="number"
                min={10}
                step={10}
                value={maxSeconds}
                onChange={(e) => setMaxSeconds(Number(e.target.value))}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white/80"
              />
            </div>
          </div>

          <button
            onClick={run}
            disabled={loading}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Video"}
          </button>

          <button
            onClick={() => data && downloadJSON(data, "personalens_video_shift.json")}
            disabled={!data}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 bg-black/30 px-5 text-sm font-semibold text-white/85 hover:bg-black/40 disabled:opacity-50"
          >
            Download JSON Report
          </button>

          {err ? <div className="text-xs text-red-300">{err}</div> : null}
        </div>
      </div>

      {/* Right results */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {!data ? (
          <div className="text-sm text-white/60">
            Upload a video and run analysis to see a visual consistency score and per-segment anomaly timeline.
          </div>
        ) : (
          <>
            {/* Score hero */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-white/60">Visual Consistency Score</div>
              <div className="mt-1 text-3xl font-semibold text-white">
                {summary.visualConsistencyScore}
                <span className="text-base text-white/60"> / 100</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-white/60" style={{ width: pct(score01) }} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill label="Spikes" value={summary.spikeCount} />
                <Pill label="Spike rate" value={`${Math.round(summary.spikeRate * 100)}%`} />
                <Pill label="Peak anomaly" value={summary.peakAnomaly} />
                <Pill label="Segments" value={summary.totalSegments} />
              </div>

              <div className="mt-3 text-xs text-white/55">
                Baseline is computed from the first {baselineSec}s (minimum 2 segments). Output indicates baseline-relative visual shifts, not truth.
              </div>
            </div>

            {/* Timeline */}
            <div className="mt-4">
              <div className="text-sm font-semibold text-white/85">Anomaly Timeline</div>
              <div className="mt-2 max-h-[360px] overflow-auto space-y-2 pr-1">
                {segments.map((s, idx) => {
                  const active = idx === selectedIdx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedIdx(idx)}
                      className={`w-full rounded-xl border p-3 text-left ${
                        active
                          ? "border-white/25 bg-white/10"
                          : "border-white/10 bg-black/20 hover:bg-black/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/70">
                          {msToClock(s.t0)} – {msToClock(s.t1)}
                        </div>
                        <div className="text-xs text-white/80">
                          z={Number(s.z).toFixed(2)}{" "}
                          {s.isSpike ? <span className="text-amber-200">• spike</span> : null}
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-white/60"
                          style={{ width: pct(clamp01(s.z / 3.0)) }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inspector */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-sm font-semibold text-white/85">Segment Inspector</div>
              {!selected ? (
                <div className="mt-2 text-xs text-white/60">Select a segment to view details.</div>
              ) : (
                <div className="mt-2 space-y-2 text-xs text-white/75">
                  <div className="flex flex-wrap gap-2">
                    <Pill label="Time" value={`${msToClock(selected.t0)}–${msToClock(selected.t1)}`} />
                    <Pill label="z" value={Number(selected.z).toFixed(3)} />
                    <Pill
                      label="Percentile vs baseline"
                      value={`${Math.round(selected.percentileVsBaseline)}%`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Pill label="Cosine sim" value={Number(selected.cosineSimToBaseline).toFixed(4)} />
                    <Pill label="Dist" value={Number(selected.distToBaseline).toFixed(4)} />
                  </div>

                  <div className="text-[11px] text-white/55">
                    Debug: frames available {selected.debug.frames_available}, used {selected.debug.frames_used}.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
