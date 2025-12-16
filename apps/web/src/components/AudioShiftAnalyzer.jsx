"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";
import {
  Upload,
  Music,
  Waves,
  Activity,
  AlertTriangle,
  Download,
  RefreshCw,
  Sparkles,
  Cpu,
  Brain,
  BarChart3,
  Target,
  Filter,
  ChevronRight,
  Shield,
  Zap,
  FileAudio,
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Eye,
  EyeOff,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";

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
      label: "Stable Delivery",
      sub: "Low baseline drift across segments",
      bar: "from-emerald-500 to-emerald-600",
      bg: "bg-gradient-to-r from-emerald-500/20 to-emerald-600/20",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      icon: CheckCircle
    };
  if (score >= 55)
    return {
      label: "Mixed Stability",
      sub: "Some drift spikes relative to baseline",
      bar: "from-amber-500 to-amber-600",
      bg: "bg-gradient-to-r from-amber-500/20 to-amber-600/20",
      border: "border-amber-500/30",
      text: "text-amber-300",
      icon: AlertTriangle
    };
  return {
    label: "Highly Variable",
    sub: "Frequent or strong delivery shifts vs baseline",
    bar: "from-rose-500 to-red-600",
    bg: "bg-gradient-to-r from-rose-500/20 to-red-600/20",
    border: "border-rose-500/30",
    text: "text-rose-300",
    icon: AlertTriangle
  };
}

function AudioMetricCard({ label, value, description, icon: Icon, trend = "neutral" }) {
  const trendColors = {
    positive: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
    negative: "from-rose-500/20 to-rose-600/20 border-rose-500/30",
    neutral: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    warning: "from-amber-500/20 to-amber-600/20 border-amber-500/30"
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border ${trendColors[trend]} bg-gradient-to-br p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {Icon && (
              <div className={`p-2 rounded-lg ${trend === "positive" ? "bg-emerald-500/20" : trend === "negative" ? "bg-rose-500/20" : trend === "warning" ? "bg-amber-500/20" : "bg-blue-500/20"}`}>
                <Icon size={16} className={`${trend === "positive" ? "text-emerald-400" : trend === "negative" ? "text-rose-400" : trend === "warning" ? "text-amber-400" : "text-blue-400"}`} />
              </div>
            )}
            <span className="text-xs font-medium text-white/70">{label}</span>
          </div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {description && (
            <div className="mt-2 text-xs text-white/60">{description}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentCard({ segment, index, isSelected, isSpike, onSelect, startTime, endTime }) {
  const theme = scoreTheme((segment.segmentAnomaly || 0) * 33.3);
  
  return (
    <button
      onClick={() => onSelect(index)}
      className={`relative w-full rounded-xl border p-4 text-left transition-all duration-300 ${
        isSelected 
          ? `${theme.border} ${theme.bg} ring-2 ring-white/20` 
          : isSpike
          ? "border-rose-500/40 bg-gradient-to-br from-rose-500/10 to-rose-600/10 hover:from-rose-500/15 hover:to-rose-600/15"
          : "border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isSpike ? "bg-rose-500/20" : "bg-white/[0.08]"}`}>
            <Clock size={16} className={isSpike ? "text-rose-400" : "text-white/60"} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              {startTime} – {endTime}
            </div>
            <div className="text-xs text-white/60 mt-1">Segment {index + 1}</div>
          </div>
        </div>
        {isSpike && (
          <div className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium">
            Spike
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-white/60">Anomaly Score</div>
          <div className="text-sm font-bold text-white">{Number(segment.segmentAnomaly || 0).toFixed(3)}</div>
        </div>
        <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
            style={{ width: `${clamp((segment.segmentAnomaly || 0) * 33.3, 0, 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="text-center p-2 rounded-lg bg-white/[0.05]">
          <div className="text-xs text-white/60">Prosody</div>
          <div className="text-sm font-medium text-white">
            {Number(segment.prosodyAnomaly || 0).toFixed(3)}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/[0.05]">
          <div className="text-xs text-white/60">Embedding</div>
          <div className="text-sm font-medium text-white">
            {Number(segment.embeddingAnomaly || 0).toFixed(3)}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConfigurationSlider({ label, value, onChange, min = 0, max = 1, step = 0.05, description }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/80">{label}</div>
        <div className="text-sm font-medium text-white">{Number(value).toFixed(2)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
      />
      {description && (
        <div className="text-xs text-white/50">{description}</div>
      )}
    </div>
  );
}

export default function AudioShiftAnalyzer() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
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

  const summary = result?.summary || {};
  const score = Number(summary.deliveryConsistencyScore ?? 0);
  const theme = scoreTheme(score);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setResult(null);
      setError("");
    }
  };

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
    <div className="relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <Waves size={24} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Audio Delivery Analysis</h1>
                <p className="text-white/70 mt-1">Baseline-relative anomaly detection using prosody and wav2vec2 embeddings</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Music size={16} />
                <span>Prosodic feature extraction + transformer embeddings</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Activity size={16} />
                <span>Real-time anomaly detection</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              setFile(null);
              setFileName("");
              setResult(null);
              setError("");
              setSelectedIdx(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upload & Configuration */}
        <div className="lg:col-span-2">
          {/* File Upload */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Audio File</h3>
                <p className="text-sm text-white/60">Upload WAV file for delivery analysis</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <FileAudio size={12} />
                <span>.wav format only</span>
              </div>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".wav,audio/wav,audio/x-wav"
                onChange={handleFileChange}
                className="hidden"
                id="audio-file-upload"
              />
              <label
                htmlFor="audio-file-upload"
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-300 ${
                  file 
                    ? "border-emerald-500/30 bg-emerald-500/10" 
                    : "border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]"
                }`}
              >
                <div className="p-4 rounded-full bg-white/[0.08] mb-4">
                  {file ? (
                    <CheckCircle size={32} className="text-emerald-400" />
                  ) : (
                    <Upload size={32} className="text-white/60" />
                  )}
                </div>
                {file ? (
                  <>
                    <div className="text-lg font-medium text-white mb-2">{fileName}</div>
                    <div className="text-sm text-white/60">Click to change file</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-medium text-white mb-2">Drop your audio file here</div>
                    <div className="text-sm text-white/60">or click to browse</div>
                    <div className="mt-4 text-xs text-white/40">Supports .wav format only</div>
                  </>
                )}
              </label>
            </div>

            {file && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle size={14} />
                <span>File ready for analysis</span>
              </div>
            )}
          </div>

          {/* Configuration Panel */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Analysis Configuration</h3>
                <p className="text-sm text-white/60">Adjust algorithm parameters for optimal results</p>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/50">
                Advanced Settings
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white/80">Use wav2vec2 Embeddings</div>
                    <div className="text-xs text-white/50 mt-1">Transformer-based audio embeddings</div>
                  </div>
                  <button
                    onClick={() => setUseEmbeddings((v) => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                      useEmbeddings ? "bg-emerald-500" : "bg-white/[0.2]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                        useEmbeddings ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {useEmbeddings && (
                  <div>
                    <div className="text-sm text-white/80 mb-3">Embedding Model</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEmbeddingModel("facebook/wav2vec2-base")}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                          embeddingModel === "facebook/wav2vec2-base"
                            ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-white"
                            : "border border-white/[0.1] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-medium">wav2vec2-base</div>
                        <div className="text-xs text-white/50 mt-1">Faster, recommended</div>
                      </button>
                      <button
                        onClick={() => setEmbeddingModel("facebook/wav2vec2-large")}
                        className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                          embeddingModel === "facebook/wav2vec2-large"
                            ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white"
                            : "border border-white/[0.1] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="font-medium">wav2vec2-large</div>
                        <div className="text-xs text-white/50 mt-1">Higher accuracy</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <ConfigurationSlider
                  label="Fusion Alpha (Prosody Weight)"
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                  min={0}
                  max={1}
                  step={0.05}
                  description="alpha=1.0: prosody only • alpha=0.0: embeddings only"
                />
                
                <div className="pt-4 border-t border-white/[0.1]">
                  <div className="text-xs text-white/50">
                    <div className="flex items-center gap-2">
                      <Brain size={12} />
                      <span>Uses prosodic features (RMS, ZCR, pitch) fused with transformer embeddings</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-white/60 flex-1">
                <div className="flex items-center gap-2">
                  <Cpu size={14} />
                  <span>API Endpoint: {API_BASE}/analyze/audio/shift</span>
                </div>
              </div>

              <button
                onClick={run}
                disabled={!canRun}
                className={`
                  relative overflow-hidden rounded-xl px-6 py-3
                  flex items-center justify-center gap-2
                  ${file
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-[0_0_40px_-12px_rgba(0,198,255,0.8)]" 
                    : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                  }
                  font-semibold text-sm transition-all duration-300 min-w-[180px]
                `}
              >
                {loading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-white/20 to-cyan-500/0 translate-x-[-200%] animate-shimmer" />
                )}
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Audio...</span>
                  </>
                ) : (
                  <>
                    <Activity size={18} />
                    <span>Analyze Delivery</span>
                    <Sparkles size={16} className="ml-1 opacity-60" />
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 to-rose-600/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-rose-400" />
                  <div>
                    <div className="font-medium text-rose-200">Analysis Error</div>
                    <div className="text-sm text-rose-300/80 mt-1">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {result?.warnings?.length > 0 && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={20} className="text-amber-400" />
                  <div>
                    <div className="font-medium text-amber-200">Warnings</div>
                    {result.warnings.map((w, i) => (
                      <div key={i} className="text-sm text-amber-300/80 mt-1">• {w}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Audio Timeline Segments */}
          {segments.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock size={20} className="text-cyan-400" />
                  Timeline Segments
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Spike segments ({spikes.size})</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {segments.map((segment, index) => (
                  <SegmentCard
                    key={index}
                    segment={segment}
                    index={index}
                    isSelected={selectedIdx === index}
                    isSpike={spikes.has(index)}
                    onSelect={setSelectedIdx}
                    startTime={msToClock(segment.startMs)}
                    endTime={msToClock(segment.endMs)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Consistency Score */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target size={20} className="text-cyan-400" />
                  Delivery Consistency Score
                </h3>
                <p className="text-sm text-white/60 mt-1">Baseline-relative delivery stability</p>
              </div>
              {result?.summary?.overallAnomaly && (
                <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70">
                  Overall Anomaly: {result.summary.overallAnomaly}
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <div className="text-6xl font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{ 
                backgroundImage: theme.bar.replace("from-", "linear-gradient(to right, ").replace("to-", ", ")
              }}>
                {score.toFixed(1)}
              </div>
              <div className="text-lg font-medium text-white mt-2">{theme.label}</div>
              <div className="text-sm text-white/60 mt-1">{theme.sub}</div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-white/60 mb-2">
                <span>Variable</span>
                <span>Stable</span>
              </div>
              <div className="h-3 w-full rounded-full bg-white/[0.08] overflow-hidden">
                <div 
                  className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="flex justify-between mt-3">
                {[0, 25, 50, 75, 100].map((mark) => (
                  <div key={mark} className="flex flex-col items-center">
                    <div className={`w-px h-2 ${score >= mark ? "bg-white/40" : "bg-white/20"}`} />
                    <span className="text-xs mt-1 text-white/40">{mark}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <AudioMetricCard 
                label="Spike Count" 
                value={summary.spikeCount || "—"}
                description="Segments above threshold"
                icon={AlertTriangle}
                trend={summary.spikeCount > 0 ? "warning" : "positive"}
              />
              <AudioMetricCard 
                label="Spike Rate" 
                value={summary.spikeRate != null ? `${(summary.spikeRate * 100).toFixed(1)}%` : "—"}
                description="Percent of spike segments"
                icon={TrendingUp}
                trend={summary.spikeRate > 0.3 ? "negative" : "positive"}
              />
              <AudioMetricCard 
                label="Peak Anomaly" 
                value={summary.peakAnomaly?.toFixed(3) || "—"}
                description="Maximum detected anomaly"
                icon={Activity}
                trend="neutral"
              />
              <AudioMetricCard 
                label="Driver" 
                value={summary.driver || "—"}
                description="Dominant feature branch"
                icon={Brain}
                trend="neutral"
              />
            </div>
          </div>

          {/* Selected Segment Details */}
          {selected && (
            <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Eye size={20} className="text-cyan-400" />
                Segment Details
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/70">Time Range</div>
                  <div className="text-sm font-medium text-white">
                    {msToClock(selected.startMs)} – {msToClock(selected.endMs)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-xl border border-white/[0.1] bg-white/[0.03]">
                    <div className="text-xs text-white/60">Segment Anomaly</div>
                    <div className="text-xl font-bold text-white mt-1">{Number(selected.segmentAnomaly || 0).toFixed(3)}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl border border-white/[0.1] bg-white/[0.03]">
                    <div className="text-xs text-white/60">Percentile vs Baseline</div>
                    <div className="text-xl font-bold text-white mt-1">{selected.percentileVsBaseline?.toFixed(1) || "—"}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-white/70 mb-3">Audio Features</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">RMS</div>
                      <div className="text-sm font-medium text-white">{selected.features?.rms?.toFixed(3) || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">ZCR</div>
                      <div className="text-sm font-medium text-white">{selected.features?.zcr?.toFixed(3) || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">Pause Ratio</div>
                      <div className="text-sm font-medium text-white">{selected.features?.pauseRatio?.toFixed(3) || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">Pitch (Hz)</div>
                      <div className="text-sm font-medium text-white">{selected.features?.pitchHz?.toFixed(1) || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">Embedding Distance</div>
                      <div className="text-sm font-medium text-white">{selected.features?.embeddingDistance?.toFixed(3) || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export & Actions */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download size={20} className="text-cyan-400" />
              Export & Actions
            </h3>
            
            <button
              onClick={downloadRunJSON}
              disabled={!result?.ok}
              className={`
                w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                transition-all duration-300 mb-3
                ${result?.ok 
                  ? "bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08]" 
                  : "bg-white/[0.02] text-white/30 cursor-not-allowed"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20">
                  <Download size={16} className="text-cyan-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Download JSON Report</div>
                  <div className="text-xs text-white/50">Complete analysis data</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/40" />
            </button>

            <div className="text-xs text-white/50">
              <div className="flex items-center gap-2">
                <Shield size={12} />
                <span>Highlights delivery shifts relative to baseline. Not deception detection or truth verification.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.02] to-transparent p-4">
        <div className="text-sm text-white/50">
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span className="font-medium">Important:</span>
            <span>Audio analysis measures delivery consistency using prosodic features and transformer embeddings. It surfaces patterns for exploration, not deception detection or truth verification.</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}