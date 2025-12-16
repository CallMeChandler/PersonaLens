"use client";

import React, { useEffect, useMemo, useState } from "react";
import { saveLastRun } from "@/lib/reportVault";
import { downloadJSON } from "@/lib/reportUtils";
import {
  Upload,
  Video,
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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Eye,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Film,
  Settings as SettingsIcon,
  Maximize2,
  Minimize2
} from "lucide-react";

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

function scoreTheme(score) {
  if (score >= 80)
    return {
      label: "Stable Visual Delivery",
      sub: "Low baseline drift across video segments",
      bar: "from-emerald-500 to-emerald-600",
      bg: "bg-gradient-to-r from-emerald-500/20 to-emerald-600/20",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      icon: CheckCircle
    };
  if (score >= 55)
    return {
      label: "Mixed Stability",
      sub: "Some visual drift spikes relative to baseline",
      bar: "from-amber-500 to-amber-600",
      bg: "bg-gradient-to-r from-amber-500/20 to-amber-600/20",
      border: "border-amber-500/30",
      text: "text-amber-300",
      icon: AlertTriangle
    };
  return {
    label: "Highly Variable",
    sub: "Frequent or strong visual shifts vs baseline",
    bar: "from-rose-500 to-red-600",
    bg: "bg-gradient-to-r from-rose-500/20 to-red-600/20",
    border: "border-rose-500/30",
    text: "text-rose-300",
    icon: AlertTriangle
  };
}

function VideoMetricCard({ label, value, description, icon: Icon, trend = "neutral" }) {
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

function VideoSegmentCard({ segment, index, isSelected, isSpike, onSelect }) {
  const theme = scoreTheme((segment.z || 0) * 33.3);
  
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
              {msToClock(segment.t0)} – {msToClock(segment.t1)}
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
          <div className="text-xs text-white/60">Anomaly Score (z)</div>
          <div className="text-sm font-bold text-white">{Number(segment.z || 0).toFixed(3)}</div>
        </div>
        <div className="h-2 w-full rounded-full bg-white/[0.08] overflow-hidden">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${theme.bar}`}
            style={{ width: `${clamp01((segment.z || 0) / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="text-center p-2 rounded-lg bg-white/[0.05]">
          <div className="text-xs text-white/60">Cosine Sim</div>
          <div className="text-sm font-medium text-white">
            {Number(segment.cosineSimToBaseline || 0).toFixed(4)}
          </div>
        </div>
        <div className="text-center p-2 rounded-lg bg-white/[0.05]">
          <div className="text-xs text-white/60">Distance</div>
          <div className="text-sm font-medium text-white">
            {Number(segment.distToBaseline || 0).toFixed(4)}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConfigurationSlider({ label, value, onChange, min = 0, max = 100, step = 1, description, unit = "" }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/80">{label}</div>
        <div className="text-sm font-medium text-white">{value}{unit}</div>
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

export default function VideoShiftAnalyzer() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [modelName, setModelName] = useState("MCG-NJU/videomae-base");
  const [framesPerSegment, setFramesPerSegment] = useState(16);
  const [targetFps, setTargetFps] = useState(8);
  const [windowSec, setWindowSec] = useState(4);
  const [hopSec, setHopSec] = useState(2);
  const [baselineSec, setBaselineSec] = useState(20);
  const [thr, setThr] = useState(1.25);
  const [maxSeconds, setMaxSeconds] = useState(300);
  const [isAdvanced, setIsAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const summary = data?.summary;
  const segments = data?.segments || [];
  
  const score = summary ? summary.visualConsistencyScore : 0;
  const score01 = score ? clamp01(score / 100) : 0;
  const theme = scoreTheme(score);

  const spikes = useMemo(() => {
    if (!segments.length) return new Set();
    const spikeSet = new Set();
    segments.forEach((seg, idx) => {
      if (seg.isSpike) spikeSet.add(idx);
    });
    return spikeSet;
  }, [segments]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function runAnalysis() {
    setError("");
    setData(null);
    setSelectedIdx(null);

    if (!file) {
      setError("Please upload a video file first.");
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
      setError(e?.message || "Failed to analyze video.");
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => {
    if (selectedIdx == null) return null;
    return segments[selectedIdx] || null;
  }, [segments, selectedIdx]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setData(null);
      setError("");
    }
  };

  function downloadRunJSON() {
    if (!data) return;
    downloadJSON(data, `personalens_video_shift_${Date.now()}.json`);
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                <Video size={24} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Visual Delivery Analysis</h1>
                <p className="text-white/70 mt-1">Baseline-relative visual consistency using VideoMAE Transformer</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Film size={16} />
                <span>Video Transformer (VideoMAE) embeddings</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Activity size={16} />
                <span>Baseline-relative shift detection</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              setFile(null);
              setFileName("");
              setPreviewUrl("");
              setData(null);
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
          {/* File Upload & Preview */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Video File</h3>
                <p className="text-sm text-white/60">Upload video for visual consistency analysis</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Video size={12} />
                <span>All video formats supported</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Area */}
              <div className="relative">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="video-file-upload"
                />
                <label
                  htmlFor="video-file-upload"
                  className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-300 h-full ${
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
                      <div className="text-lg font-medium text-white mb-2 truncate w-full text-center">{fileName}</div>
                      <div className="text-sm text-white/60">Click to change file</div>
                    </>
                  ) : (
                    <>
                      <div className="text-lg font-medium text-white mb-2">Drop your video here</div>
                      <div className="text-sm text-white/60">or click to browse</div>
                      <div className="mt-4 text-xs text-white/40">Supports MP4, MOV, AVI, etc.</div>
                    </>
                  )}
                </label>
              </div>

              {/* Video Preview */}
              {previewUrl && (
                <div className="relative">
                  <div className="text-sm text-white/80 mb-3 flex items-center justify-between">
                    <span>Preview</span>
                    <div className="text-xs text-white/50">
                      {file && `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </div>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.1] bg-black/50">
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      className="w-full h-48 object-contain bg-black"
                    />
                  </div>
                </div>
              )}
            </div>

            {file && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle size={14} />
                <span>Video ready for analysis</span>
              </div>
            )}
          </div>

          {/* Configuration Panel */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <SettingsIcon size={20} className="text-cyan-400" />
                  Analysis Configuration
                </h3>
                <p className="text-sm text-white/60">Adjust VideoMAE parameters for optimal results</p>
              </div>
              <button
                onClick={() => setIsAdvanced(!isAdvanced)}
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70 hover:text-white hover:bg-white/[0.12] transition-all duration-300"
              >
                {isAdvanced ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                {isAdvanced ? "Basic Settings" : "Advanced Settings"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-white/80 mb-3">VideoMAE Model</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setModelName("MCG-NJU/videomae-base")}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        modelName === "MCG-NJU/videomae-base"
                          ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-white"
                          : "border border-white/[0.1] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="font-medium">VideoMAE Base</div>
                      <div className="text-xs text-white/50 mt-1">Faster, recommended</div>
                    </button>
                    <button
                      onClick={() => setModelName("MCG-NJU/videomae-base-finetuned-kinetics")}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        modelName === "MCG-NJU/videomae-base-finetuned-kinetics"
                          ? "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white"
                          : "border border-white/[0.1] bg-white/[0.03] text-white/70 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="font-medium">Kinetics Fine-tuned</div>
                      <div className="text-xs text-white/50 mt-1">Higher accuracy</div>
                    </button>
                  </div>
                </div>

                <ConfigurationSlider
                  label="Frames per Segment"
                  value={framesPerSegment}
                  onChange={(e) => setFramesPerSegment(Number(e.target.value))}
                  min={4}
                  max={32}
                  step={1}
                  description="Number of frames in each segment for VideoMAE"
                />

                <ConfigurationSlider
                  label="Target FPS"
                  value={targetFps}
                  onChange={(e) => setTargetFps(Number(e.target.value))}
                  min={1}
                  max={30}
                  step={1}
                  description="Frames per second for processing"
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {isAdvanced && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-white/80 mb-2">Window (sec)</div>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={windowSec}
                          onChange={(e) => setWindowSec(Number(e.target.value))}
                          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white/80"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-white/80 mb-2">Hop (sec)</div>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={hopSec}
                          onChange={(e) => setHopSec(Number(e.target.value))}
                          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white/80"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-white/80 mb-2">Baseline (sec)</div>
                        <input
                          type="number"
                          min={4}
                          step={1}
                          value={baselineSec}
                          onChange={(e) => setBaselineSec(Number(e.target.value))}
                          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white/80"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-white/80 mb-2">Spike Threshold (z)</div>
                        <input
                          type="number"
                          min={0.5}
                          step={0.05}
                          value={thr}
                          onChange={(e) => setThr(Number(e.target.value))}
                          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white/80"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/80 mb-2">Max Seconds</div>
                      <input
                        type="number"
                        min={10}
                        step={10}
                        value={maxSeconds}
                        onChange={(e) => setMaxSeconds(Number(e.target.value))}
                        className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white/80"
                      />
                      <div className="text-xs text-white/50 mt-2">Maximum duration to analyze (0 = full video)</div>
                    </div>
                  </>
                )}

                <div className="pt-4 border-t border-white/[0.1]">
                  <div className="text-xs text-white/50">
                    <div className="flex items-center gap-2">
                      <Brain size={12} />
                      <span>VideoMAE extracts spatiotemporal features for baseline-relative consistency scoring</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
              <div className="text-sm text-white/60 flex-1">
                <div className="flex items-center gap-2">
                  <Cpu size={14} />
                  <span>API Endpoint: {API_BASE}/analyze/video/shift</span>
                </div>
              </div>

              <button
                onClick={runAnalysis}
                disabled={!file || loading}
                className={`
                  relative overflow-hidden rounded-xl px-6 py-3
                  flex items-center justify-center gap-2
                  ${file
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.8)]" 
                    : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                  }
                  font-semibold text-sm transition-all duration-300 min-w-[180px]
                `}
              >
                {loading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-white/20 to-purple-500/0 translate-x-[-200%] animate-shimmer" />
                )}
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Video...</span>
                  </>
                ) : (
                  <>
                    <Activity size={18} />
                    <span>Analyze Visual Delivery</span>
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
          </div>

          {/* Video Timeline Segments */}
          {segments.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock size={20} className="text-purple-400" />
                  Visual Shift Timeline
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
                  <VideoSegmentCard
                    key={index}
                    segment={segment}
                    index={index}
                    isSelected={selectedIdx === index}
                    isSpike={spikes.has(index)}
                    onSelect={setSelectedIdx}
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
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target size={20} className="text-purple-400" />
                  Visual Consistency Score
                </h3>
                <p className="text-sm text-white/60 mt-1">Baseline-relative visual delivery stability</p>
              </div>
              {summary?.totalSegments && (
                <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70">
                  {summary.totalSegments} segments
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <div className="text-6xl font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{ 
                backgroundImage: theme.bar.replace("from-", "linear-gradient(to right, ").replace("to-", ", ")
              }}>
                {score}
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
              <VideoMetricCard 
                label="Spike Count" 
                value={summary?.spikeCount || "—"}
                description="Segments above threshold"
                icon={AlertTriangle}
                trend={summary?.spikeCount > 0 ? "warning" : "positive"}
              />
              <VideoMetricCard 
                label="Spike Rate" 
                value={summary?.spikeRate != null ? `${Math.round(summary.spikeRate * 100)}%` : "—"}
                description="Percent of spike segments"
                icon={TrendingUp}
                trend={summary?.spikeRate > 0.3 ? "negative" : "positive"}
              />
              <VideoMetricCard 
                label="Peak Anomaly" 
                value={summary?.peakAnomaly?.toFixed(3) || "—"}
                description="Maximum detected anomaly"
                icon={Activity}
                trend="neutral"
              />
              <VideoMetricCard 
                label="Baseline" 
                value={`${baselineSec}s`}
                description="Reference duration"
                icon={Clock}
                trend="neutral"
              />
            </div>
          </div>

          {/* Selected Segment Details */}
          {selected && (
            <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Eye size={20} className="text-purple-400" />
                Segment Details
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white/70">Time Range</div>
                  <div className="text-sm font-medium text-white">
                    {msToClock(selected.t0)} – {msToClock(selected.t1)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-xl border border-white/[0.1] bg-white/[0.03]">
                    <div className="text-xs text-white/60">Z-Score</div>
                    <div className="text-xl font-bold text-white mt-1">{Number(selected.z || 0).toFixed(3)}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl border border-white/[0.1] bg-white/[0.03]">
                    <div className="text-xs text-white/60">Percentile</div>
                    <div className="text-xl font-bold text-white mt-1">{selected.percentileVsBaseline?.toFixed(1) || "—"}%</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-white/70 mb-3">Video Features</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">Cosine Similarity</div>
                      <div className="text-sm font-medium text-white">{Number(selected.cosineSimToBaseline || 0).toFixed(4)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.05]">
                      <div className="text-xs text-white/60">Distance</div>
                      <div className="text-sm font-medium text-white">{Number(selected.distToBaseline || 0).toFixed(4)}</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-white/50 pt-4 border-t border-white/[0.1]">
                  <div className="flex items-center gap-2">
                    <Settings size={12} />
                    <span>Debug: {selected.debug?.frames_available || 0} frames available, {selected.debug?.frames_used || 0} used</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export & Actions */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download size={20} className="text-purple-400" />
              Export & Actions
            </h3>
            
            <button
              onClick={downloadRunJSON}
              disabled={!data}
              className={`
                w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                transition-all duration-300 mb-3
                ${data 
                  ? "bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08]" 
                  : "bg-white/[0.02] text-white/30 cursor-not-allowed"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Download size={16} className="text-purple-400" />
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
                <span>Highlights visual delivery shifts relative to baseline. Not deception detection or truth verification.</span>
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
            <span>Video analysis measures visual consistency using VideoMAE transformer embeddings. It surfaces patterns for exploration, not deception detection or truth verification.</span>
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