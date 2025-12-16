"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON, copyToClipboard, clip } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Download,
  Copy,
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
  Activity,
  FileText,
  Link,
  AlertCircle,
  Clock,
  CalendarDays,
  LineChart,
  Layers,
  GitBranch,
  Eye,
  EyeOff,
  Plus,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Search
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function TimelineChart({ values = [], labels = [], highlight = [], windowDrifts = [], windowLabels = [] }) {
  const width = 520;
  const height = 160;
  const pad = 14;

  const safe = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  const minV = safe.length ? Math.min(...safe) : 0;
  const maxV = safe.length ? Math.max(...safe) : 100;
  const range = maxV - minV || 1;

  const pts = values.map((v, i) => {
    const x =
      values.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (values.length - 1);
    const y = height - pad - ((clamp(v ?? 0, 0, 100) - minV) * (height - pad * 2)) / range;
    return { x, y, i };
  });

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[520px] rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.02] to-white/[0.01] backdrop-blur-sm"
      >
        {/* Grid background */}
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="rgba(255,255,255,0.10)"
        />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.10)" />
        
        {/* Dashed horizontal lines */}
        {[0.25, 0.5, 0.75].map((pos) => (
          <line
            key={pos}
            x1={pad}
            y1={pad + (height - pad * 2) * (1 - pos)}
            x2={width - pad}
            y2={pad + (height - pad * 2) * (1 - pos)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2,2"
          />
        ))}

        {/* Drift line */}
        <polyline
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="2"
          points={polyline}
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Points */}
        {pts.map((p) => {
          const isHot = highlight?.[p.i];
          return (
            <g key={p.i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill={isHot ? "rgba(248,113,113,0.95)" : "rgba(255,255,255,0.15)"}
                stroke={isHot ? "#f87171" : "rgba(255,255,255,0.4)"}
                strokeWidth="1.5"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={isHot ? "white" : "rgba(255,255,255,0.8)"}
              />
            </g>
          );
        })}
      </svg>

      {labels?.length ? (
        <div className="mt-2 flex min-w-[520px] justify-between gap-2 text-[11px] text-white/55 px-2">
          <div className="flex items-center gap-1">
            <CalendarDays size={10} />
            <span>{labels[0]}</span>
          </div>
          <div className="text-white/35">…</div>
          <div className="flex items-center gap-1">
            <CalendarDays size={10} />
            <span>{labels[labels.length - 1]}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimelineCard({ title, value, description, icon: Icon, trend = "neutral" }) {
  const trendColors = {
    positive: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
    negative: "from-rose-500/20 to-rose-600/20 border-rose-500/30",
    neutral: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    warning: "from-amber-500/20 to-amber-600/20 border-amber-500/30"
  };

  const trendIcons = {
    positive: TrendingUp,
    negative: TrendingDown,
    neutral: Activity,
    warning: AlertTriangle
  };

  const TrendIcon = trendIcons[trend];

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
            <span className="text-xs font-medium text-white/70">{title}</span>
          </div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {description && (
            <div className="mt-2 text-xs text-white/60">{description}</div>
          )}
        </div>
        <TrendIcon size={16} className={trend === "positive" ? "text-emerald-400" : trend === "negative" ? "text-rose-400" : trend === "warning" ? "text-amber-400" : "text-blue-400"} />
      </div>
    </div>
  );
}

function OutlierCard({ date, text, tags = [], keywords = [], signals, similarity, index, isExpanded, onToggle }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-600/10 p-5 backdrop-blur-sm transition-all duration-300 ${isExpanded ? "ring-2 ring-rose-500/20" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400" />
            <h3 className="font-semibold text-white">Outlier #{index + 1}</h3>
          </div>
          <p className="text-sm text-rose-300/80 mt-1 flex items-center gap-2">
            <Calendar size={12} />
            {date}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 transition-colors"
        >
          {isExpanded ? <EyeOff size={16} className="text-rose-400" /> : <Eye size={16} className="text-rose-400" />}
        </button>
      </div>

      <div className={`${isExpanded ? "" : "line-clamp-2"} text-sm text-rose-50/90 mb-4`}>
        "{clip(text, isExpanded ? 300 : 120)}"
      </div>

      {signals && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-rose-500/10">
            <div className="text-xs text-rose-300/70">Words</div>
            <div className="text-sm font-bold text-white">{signals.wordCount}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-500/10">
            <div className="text-xs text-rose-300/70">Metrics</div>
            <div className="text-sm font-bold text-white">{signals.metricHits}</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-rose-500/10">
            <div className="text-xs text-rose-300/70">Buzzwords</div>
            <div className="text-sm font-bold text-white">{signals.buzzwordHits}</div>
          </div>
        </div>
      )}

      {similarity !== undefined && (
        <div className="mb-4">
          <div className="text-xs text-rose-300/70 mb-1">Semantic Similarity to Centroid</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-rose-500/20 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                style={{ width: `${similarity * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-white">{(similarity * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {tags.length > 0 && (
            <div>
              <div className="text-sm text-rose-300/70 mb-2">Linguistic Signals</div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {keywords.length > 0 && (
            <div>
              <div className="text-sm text-rose-300/70 mb-2">Key Terms</div>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.05] text-rose-200/80 text-xs border border-rose-500/20"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PairwiseItem({ fromDate, toDate, driftScore, similarity }) {
  const getDriftLevel = (score) => {
    if (!score && score !== 0) return null;
    if (score < 0.3) return { label: "Low", color: "from-emerald-500 to-teal-500" };
    if (score < 0.6) return { label: "Moderate", color: "from-amber-500 to-orange-500" };
    return { label: "High", color: "from-rose-500 to-red-500" };
  };

  const driftLevel = getDriftLevel(driftScore);

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <GitBranch size={16} className="text-blue-400" />
        </div>
        <div>
          <div className="text-sm text-white">
            {fromDate} → {toDate}
          </div>
          <div className="text-xs text-white/60">Adjacent drift</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-lg font-bold bg-gradient-to-r ${driftLevel?.color || "from-gray-500 to-gray-600"} bg-clip-text text-transparent`}>
          {driftScore?.toFixed(4) || "—"}
        </div>
        <div className="text-xs text-white/60">Sim: {similarity?.toFixed(4) || "—"}</div>
      </div>
    </div>
  );
}

/** Bulk importer: YYYY-MM-DD - text (also | : —) */
function parseDumpToItems(dump) {
  const lines = (dump || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];

  for (const line of lines) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*([\-|:–—])\s*(.+)$/);
    if (m) {
      out.push({ date: m[1], text: m[3].trim() });
      continue;
    }
    const m2 = line.match(/^(\d{4}-\d{2}-\d{2})\s{2,}(.+)$/);
    if (m2) {
      out.push({ date: m2[1], text: m2[2].trim() });
      continue;
    }
  }

  return out;
}

function buildTimelineLinkedInSummary({ timeline, reasons, payloadItems, outlierPayloadIndices }) {
  if (!timeline?.ok) return "";

  const windows = timeline.windows || [];
  const pairwise = timeline.pairwise || [];

  const topWindows = windows
    .slice()
    .sort((a, b) => (b.driftScore || 0) - (a.driftScore || 0))
    .slice(0, 3);

  const topPairwise = pairwise
    .slice()
    .sort((a, b) => (b.driftScore || 0) - (a.driftScore || 0))
    .slice(0, 3);

  const reasonsByIndex = new Map();
  for (const it of reasons?.items || []) reasonsByIndex.set(it.index, it);

  const tagFreq = new Map();
  const kwFreq = new Map();

  for (const idx of outlierPayloadIndices || []) {
    const r = reasonsByIndex.get(idx);
    for (const t of r?.reasonTags || []) tagFreq.set(t, (tagFreq.get(t) || 0) + 1);
    for (const k of r?.keywords || []) kwFreq.set(k, (kwFreq.get(k) || 0) + 1);
  }

  const topTags = Array.from(tagFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  const topKws = Array.from(kwFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);

  const lines = [];
  lines.push("PersonaLens: timeline drift + outlier reasons (transformer embeddings)");
  lines.push("");
  lines.push(
    `What it does: measures semantic drift across dated posts and flags outliers; adds lightweight reason tags and keywords (not fact-checking).`
  );
  lines.push(
    `Run stats: ${timeline.count} items • window=${timeline.window} • stride=${timeline.stride} • model=${timeline.embeddingModel}`
  );
  lines.push("");

  if (topWindows.length) {
    lines.push("Top drift windows:");
    for (const w of topWindows) {
      lines.push(`- ${w.startDate} → ${w.endDate}: drift ${w.driftScore} (mean sim ${w.meanSimilarity})`);
    }
    lines.push("");
  }

  if (topPairwise.length) {
    lines.push("Top adjacent jumps:");
    for (const p of topPairwise) {
      lines.push(`- ${p.fromDate} → ${p.toDate}: drift ${p.driftScore} (sim ${p.similarity})`);
    }
    lines.push("");
  }

  lines.push(`Outliers flagged: ${outlierPayloadIndices?.length || 0}`);
  if (topTags.length) lines.push(`Most common reasons: ${topTags.join(" • ")}`);
  if (topKws.length) lines.push(`Keywords: ${topKws.join(", ")}`);
  lines.push("");

  if ((outlierPayloadIndices || []).length) {
    const first = outlierPayloadIndices[0];
    const sample = payloadItems?.[first]?.text || "";
    if (sample) {
      lines.push(`Example outlier snippet: "${clip(sample, 180)}"`);
      lines.push("");
    }
  }

  lines.push("Notes: This surfaces linguistic/semantic consistency signals. It does not claim deception detection or truth verification.");
  lines.push("Repo: PersonaLens (FastAPI + Next.js) • Tabs: Single Text / Drift / Timeline / Clusters");

  return lines.join("\n");
}

export default function TimelineAnalyzer() {
  const [items, setItems] = useState([
    { date: "2024-01-10", text: "Built an LLM retrieval pipeline; improved answer accuracy by 18% in Q1." },
    { date: "2024-03-05", text: "Shipped an agentic workflow for support automation; reduced response time by 35%." },
    { date: "2024-06-20", text: "I leverage synergy and scalable paradigms to disrupt industries." },
    { date: "2024-08-01", text: "Optimized eval harness and prompt tests; cut regressions by 22%." },
  ]);

  const [windowSize, setWindowSize] = useState(3);
  const [stride, setStride] = useState(1);
  const [bulkDump, setBulkDump] = useState("");
  const [bulkInfo, setBulkInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [reasons, setReasons] = useState(null);
  const [reasonsError, setReasonsError] = useState("");
  const [indexMap, setIndexMap] = useState([]);
  const [copied, setCopied] = useState("");
  const [expandedOutlier, setExpandedOutlier] = useState(null);

  function updateItem(i, patch) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
    setResult(null);
    setReasons(null);
    setError("");
    setReasonsError("");
    setCopied("");
  }

  function addRow() {
    setItems((prev) => [...prev, { date: "", text: "" }]);
    setResult(null);
    setReasons(null);
    setError("");
    setReasonsError("");
    setCopied("");
  }

  function removeRow(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
    setReasons(null);
    setError("");
    setReasonsError("");
    setCopied("");
  }

  const payloadWithMap = useMemo(() => {
    const arr = [];
    for (let uiIndex = 0; uiIndex < items.length; uiIndex++) {
      const d = (items[uiIndex].date || "").trim();
      const t = (items[uiIndex].text || "").trim();
      if (d && t) arr.push({ date: d, text: t, uiIndex });
    }
    return arr;
  }, [items]);

  const payloadItems = useMemo(
    () => payloadWithMap.map(({ date, text }) => ({ date, text })),
    [payloadWithMap]
  );

  const nextIndexMap = useMemo(() => payloadWithMap.map((x) => x.uiIndex), [payloadWithMap]);

  const reasonsByIndex = useMemo(() => {
    const m = new Map();
    for (const it of reasons?.items || []) m.set(it.index, it);
    return m;
  }, [reasons]);

  const outlierPayloadIndices = useMemo(() => {
    const s = new Set();
    for (const w of result?.windows || []) {
      for (const idx of w.outlierIndices || []) s.add(idx);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [result]);

  const outlierUISet = useMemo(() => {
    const s = new Set();
    for (const payloadIdx of outlierPayloadIndices) {
      const uiIdx = indexMap[payloadIdx];
      if (typeof uiIdx === "number") s.add(uiIdx);
    }
    return s;
  }, [outlierPayloadIndices, indexMap]);

  const windowDrifts = useMemo(() => (result?.windows || []).map((w) => w.driftScore), [result]);
  const windowLabels = useMemo(() => (result?.windows || []).map((w) => w.endDate), [result]);
  const windowHighlights = useMemo(
    () => (result?.windows || []).map((w) => (w.outlierIndices || []).length > 0),
    [result]
  );

  function importBulk() {
    setBulkInfo("");
    setError("");
    setReasonsError("");
    setResult(null);
    setReasons(null);
    setCopied("");

    const parsed = parseDumpToItems(bulkDump);
    if (!parsed.length) {
      setBulkInfo("No valid lines found. Use: YYYY-MM-DD - your text (or | / : / —).");
      return;
    }

    setItems(parsed);
    setBulkInfo(`Imported ${parsed.length} items.`);
  }

  async function fetchReasonsForTexts(texts) {
    setReasonsError("");
    setReasons(null);

    try {
      const res = await fetch(`${API_BASE}/analyze/text/reasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Reasons API ${res.status}: ${msg || "Request failed"}`);
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Reasons analysis failed.");

      setReasons(data);
      return data;
    } catch (e) {
      setReasonsError(e?.message || "Failed to fetch reasons.");
      return null;
    }
  }

  async function runTimeline() {
    setError("");
    setReasonsError("");
    setResult(null);
    setReasons(null);
    setCopied("");
    setExpandedOutlier(null);

    if (payloadItems.length < 2) {
      setError("Add at least 2 valid rows (date + text) to compute timeline drift.");
      return;
    }

    setLoading(true);
    try {
      setIndexMap(nextIndexMap);

      const res = await fetch(`${API_BASE}/analyze/text/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          window: Number(windowSize) || 3,
          stride: Number(stride) || 1,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`API ${res.status}: ${msg || "Request failed"}`);
      }

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Timeline analysis failed.");

      setResult(data);

      const textsForReasons = payloadItems.map((x) => x.text);
      const reasonsData = await fetchReasonsForTexts(textsForReasons);

      saveLastRun("timeline", {
        meta: {
          generatedAt: new Date().toISOString(),
          apiBase: API_BASE,
        },
        input: {
          items: payloadItems,
          window: Number(windowSize) || 3,
          stride: Number(stride) || 1,
        },
        output: {
          timeline: data,
          reasons: reasonsData,
        },
      });
      await fetchReasonsForTexts(textsForReasons);
    } catch (e) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onCopySummary() {
    setCopied("");
    if (!result?.ok) return;

    const summary = buildTimelineLinkedInSummary({
      timeline: result,
      reasons,
      payloadItems,
      outlierPayloadIndices,
    });

    const ok = await copyToClipboard(summary);
    setCopied(ok ? "Summary copied to clipboard!" : "Copy failed (browser permissions).");
    setTimeout(() => setCopied(""), 2200);
  }

  function onDownloadJSON() {
    if (!result?.ok) return;

    downloadJSON("personalens-timeline-report", {
      meta: {
        generatedAt: new Date().toISOString(),
        apiBase: API_BASE,
        analyzer: "timeline",
        params: { window: Number(windowSize) || 3, stride: Number(stride) || 1 },
      },
      input: { items: payloadItems },
      output: { timeline: result, reasons: reasons ?? null },
    });
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <Calendar size={24} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Timeline Analysis</h1>
                <p className="text-white/70 mt-1">Track semantic drift and consistency across dated posts</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Clock size={16} />
                <span>Temporal semantic analysis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <TrendingUp size={16} />
                <span>Rolling window drift detection</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              setItems([
                { date: "2024-01-10", text: "Built an LLM retrieval pipeline; improved answer accuracy by 18% in Q1." },
                { date: "2024-03-05", text: "Shipped an agentic workflow for support automation; reduced response time by 35%." },
                { date: "2024-06-20", text: "I leverage synergy and scalable paradigms to disrupt industries." },
                { date: "2024-08-01", text: "Optimized eval harness and prompt tests; cut regressions by 22%." },
              ]);
              setResult(null);
              setReasons(null);
              setError("");
              setCopied("");
              setBulkDump("");
              setBulkInfo("");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input & Configuration */}
        <div className="lg:col-span-2">
          {/* Bulk Import */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Bulk Import</h3>
                <p className="text-sm text-white/60">Paste LinkedIn dump for quick import</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Search size={12} />
                <span>Format: YYYY-MM-DD - text</span>
              </div>
            </div>

            <textarea
              value={bulkDump}
              onChange={(e) => setBulkDump(e.target.value)}
              placeholder={`2024-01-10 - Built an LLM retrieval pipeline; improved answer accuracy by 18%.\n2024-03-05 | Shipped an agentic workflow; reduced response time by 35%.\n2024-06-20 - I leverage synergy and scalable paradigms to disrupt industries.`}
              className="w-full h-32 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300 resize-none break-words whitespace-pre-wrap"
              style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'break-word'
              }}
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="text-sm text-white/50 flex-1">
                {bulkInfo ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle size={14} />
                    <span>{bulkInfo}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>Supports | : — as separators</span>
                  </div>
                )}
              </div>

              <button
                onClick={importBulk}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] text-white hover:text-white hover:bg-white/[0.08] transition-all duration-300"
              >
                <FileText size={16} />
                Import Bulk Data
              </button>
            </div>
          </div>

          {/* Timeline Items */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Timeline Items</h3>
                <p className="text-sm text-white/60">Add dated posts or statements for analysis</p>
              </div>
              <button
                onClick={addRow}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] text-white hover:text-white hover:bg-white/[0.08] transition-all duration-300"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((it, i) => {
                const isOutlier = outlierUISet.has(i);
                const showRemove = items.length > 2;

                return (
                  <div
                    key={i}
                    className={`relative rounded-xl border ${isOutlier ? "border-rose-500/40" : "border-white/[0.1]"} ${isOutlier ? "bg-gradient-to-br from-rose-500/10 to-rose-600/10" : "bg-white/[0.03]"} p-4 backdrop-blur-sm transition-all duration-300`}
                  >
                    {isOutlier && (
                      <div className="absolute -top-2 -right-2 px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30">
                        Outlier
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isOutlier ? "bg-rose-500/20" : "bg-blue-500/10"}`}>
                          <Calendar size={18} className={isOutlier ? "text-rose-400" : "text-blue-400"} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Item {i + 1}</h4>
                          <p className="text-xs text-white/60">Date your content</p>
                        </div>
                      </div>
                      
                      {showRemove && (
                        <button
                          onClick={() => removeRow(i)}
                          className="p-2 rounded-lg bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <div className="text-xs text-white/70 mb-2">Date</div>
                        <input
                          type="date"
                          value={it.date}
                          onChange={(e) => updateItem(i, { date: e.target.value })}
                          className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-300"
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <div className="text-xs text-white/70 mb-2">Content</div>
                        <textarea
                          value={it.text}
                          onChange={(e) => updateItem(i, { text: e.target.value })}
                          placeholder="Paste the post, statement, or content for this date..."
                          className="w-full h-24 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-300 resize-none break-words whitespace-pre-wrap"
                          style={{ 
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration & Actions */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                <div>
                  <div className="text-sm text-white/70 mb-2">Window Size</div>
                  <div className="relative">
                    <input
                      type="number"
                      min={2}
                      value={windowSize}
                      onChange={(e) => setWindowSize(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300"
                    />
                    <div className="text-xs text-white/50 mt-2">Number of posts per analysis window</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-white/70 mb-2">Stride</div>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      value={stride}
                      onChange={(e) => setStride(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300"
                    />
                    <div className="text-xs text-white/50 mt-2">Step size between consecutive windows</div>
                  </div>
                </div>
              </div>

              <button
                onClick={runTimeline}
                disabled={loading || payloadItems.length < 2}
                className={`
                  relative overflow-hidden rounded-xl px-6 py-3
                  flex items-center justify-center gap-2
                  ${payloadItems.length >= 2
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
                    <span>Analyzing Timeline...</span>
                  </>
                ) : (
                  <>
                    <Activity size={18} />
                    <span>Analyze Timeline</span>
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
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <LineChart size={20} className="text-cyan-400" />
                  Timeline Overview
                </h3>
                <p className="text-sm text-white/60 mt-1">Analysis summary and metrics</p>
              </div>
              {result?.embeddingModel && (
                <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70">
                  Model: {result.embeddingModel}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <TimelineCard 
                title="Items" 
                value={result?.count || "—"}
                description="Posts analyzed"
                icon={FileText}
                trend="neutral"
              />
              <TimelineCard 
                title="Outliers" 
                value={outlierPayloadIndices.length}
                description="Anomalies detected"
                icon={AlertTriangle}
                trend={outlierPayloadIndices.length > 0 ? "warning" : "positive"}
              />
              <TimelineCard 
                title="Window Size" 
                value={windowSize}
                description="Analysis window"
                icon={Layers}
                trend="neutral"
              />
              <TimelineCard 
                title="Stride" 
                value={stride}
                description="Window step size"
                icon={TrendingUp}
                trend="neutral"
              />
            </div>

            {/* Timeline Chart */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-white/70">Rolling Window Drift Trend</div>
                <div className="text-xs text-white/50 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Outlier windows</span>
                  </div>
                </div>
              </div>
              
              {result?.windows?.length ? (
                <TimelineChart 
                  values={windowDrifts} 
                  labels={windowLabels} 
                  highlight={windowHighlights}
                />
              ) : (
                <div className="rounded-2xl border border-white/[0.1] bg-white/[0.02] p-8 text-center">
                  <LineChart size={40} className="mx-auto mb-3 text-white/20" />
                  <p className="text-white/40">Run analysis to see drift trend</p>
                </div>
              )}
            </div>
          </div>

          {/* Export & Share */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download size={20} className="text-cyan-400" />
              Export & Share
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={onDownloadJSON}
                disabled={!result?.ok}
                className={`
                  w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                  transition-all duration-300
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
                    <div className="text-xs text-white/50">Complete timeline analysis</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/40" />
              </button>

              <button
                onClick={onCopySummary}
                disabled={!result?.ok}
                className={`
                  w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                  transition-all duration-300
                  ${result?.ok 
                    ? "bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08]" 
                    : "bg-white/[0.02] text-white/30 cursor-not-allowed"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Link size={16} className="text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Copy LinkedIn Summary</div>
                    <div className="text-xs text-white/50">Formatted analysis insights</div>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/40" />
              </button>
            </div>

            {copied && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <div className="text-sm text-emerald-300">{copied}</div>
                </div>
              </div>
            )}
          </div>

          {/* Outlier Analysis */}
          {outlierPayloadIndices.length > 0 && (
            <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle size={20} className="text-rose-400" />
                  Outlier Analysis
                </h3>
                <div className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-medium">
                  {outlierPayloadIndices.length} detected
                </div>
              </div>

              <div className="space-y-4">
                {outlierPayloadIndices.map((payloadIdx, index) => {
                  const uiIdx = indexMap[payloadIdx];
                  const reasonItem = reasonsByIndex.get(payloadIdx);
                  
                  const uiDate =
                    typeof uiIdx === "number"
                      ? items?.[uiIdx]?.date || result?.dates?.[payloadIdx] || "—"
                      : result?.dates?.[payloadIdx] || "—";

                  const uiText = typeof uiIdx === "number" ? (items?.[uiIdx]?.text || "").trim() : "";
                  
                  return (
                    <OutlierCard
                      key={payloadIdx}
                      date={uiDate}
                      text={uiText}
                      tags={reasonItem?.reasonTags || []}
                      keywords={reasonItem?.keywords || []}
                      signals={reasonItem?.signals}
                      similarity={reasonItem?.semanticSimilarityToCentroid}
                      index={index}
                      isExpanded={expandedOutlier === payloadIdx}
                      onToggle={() => setExpandedOutlier(expandedOutlier === payloadIdx ? null : payloadIdx)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Pairwise Drift */}
          {result?.pairwise?.length > 0 && (
            <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <GitBranch size={20} className="text-cyan-400" />
                Adjacent Drift Analysis
              </h3>
              
              <div className="space-y-3">
                {(result.pairwise || []).map((p, idx) => (
                  <PairwiseItem
                    key={idx}
                    fromDate={p.fromDate}
                    toDate={p.toDate}
                    driftScore={p.driftScore}
                    similarity={p.similarity}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Debug Panel */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Cpu size={20} className="text-amber-400" />
                Debug Output
              </h3>
              <div className="text-xs px-3 py-1 rounded-full bg-white/[0.08] text-white/50">
                Raw API Response
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-xl border border-white/[0.05] bg-black/20" />
              <pre className="relative max-h-64 overflow-auto rounded-xl p-4 text-xs text-white/70 bg-black/30 backdrop-blur-sm">
                {JSON.stringify(
                  { 
                    timeline: result ?? null, 
                    reasons: reasons ?? null,
                    api: `${API_BASE}/analyze/text/timeline`
                  }, 
                  null, 2
                )}
              </pre>
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
            <span>Timeline analysis measures semantic consistency over time using transformer embeddings. It surfaces patterns for exploration, not deception detection or truth verification.</span>
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