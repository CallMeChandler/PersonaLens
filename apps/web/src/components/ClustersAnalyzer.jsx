"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON, copyToClipboard, clip } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";
import {
  Layers,
  Target,
  TrendingUp,
  Download,
  Copy,
  RefreshCw,
  Sparkles,
  Cpu,
  Brain,
  BarChart3,
  Filter,
  ChevronRight,
  Shield,
  Zap,
  Activity,
  FileText,
  Link,
  AlertCircle,
  Hash,
  Maximize2,
  Minimize2,
  Search,
  Tag,
  Users,
  PieChart,
  Network,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/**
 * Accepts:
 * - Blank-line separated blocks (recommended)
 * - Or per-line entries (fallback)
 */
function parseTexts(raw) {
    const s = (raw || "").trim();
    if (!s) return [];

    const blocks = s
        .split(/\n\s*\n/g)
        .map((b) => b.trim())
        .filter(Boolean);

    if (blocks.length >= 2) return blocks;

    return s
        .split(/\r?\n/g)
        .map((l) => l.trim())
        .filter(Boolean);
}

function buildLinkedInSummary(result, texts) {
    if (!result?.ok) return "";

    const clusters = (result.clusters || []).slice().sort((a, b) => (b.size || 0) - (a.size || 0));
    const top = clusters.slice(0, 4);

    const lines = [];
    lines.push("PersonaLens: transformer-based persona topic clustering");
    lines.push("");
    lines.push(`What it does: groups posts/snippets into semantic "persona themes" using sentence-transformer embeddings + k-means (cosine).`);
    lines.push(`Run stats: ${result.count} texts • k=${result.k} • model=${result.embeddingModel}`);
    lines.push("");

    lines.push("Top clusters:");
    for (const c of top) {
        const kws = (c.topKeywords || []).slice(0, 3).join(", ");
        lines.push(`- ${c.label} (${c.size}) • keywords: ${kws}`);
        if (typeof c.representativeIndex === "number") {
            lines.push(`  rep: "${clip(texts[c.representativeIndex], 140)}"`);
        }
    }

    lines.push("");
    lines.push("Notes: This is not fact-checking. It surfaces semantic structure and consistency signals in your content.");
    lines.push("");
    lines.push("Repo: PersonaLens (FastAPI + Next.js) • Tabs: Single Text signals / Drift / Timeline Drift / Clusters");

    return lines.join("\n");
}

function ClusterCard({ cluster, items, texts, clusterIndex, isExpanded, onToggle }) {
    const getClusterColor = (index) => {
        const colors = [
            "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
            "from-purple-500/20 to-pink-500/20 border-purple-500/30",
            "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
            "from-amber-500/20 to-orange-500/20 border-amber-500/30",
            "from-rose-500/20 to-red-500/20 border-rose-500/30",
            "from-indigo-500/20 to-violet-500/20 border-indigo-500/30"
        ];
        return colors[index % colors.length];
    };

    const colorClass = getClusterColor(clusterIndex);

    return (
        <div className={`relative rounded-2xl border bg-gradient-to-br p-6 backdrop-blur-sm transition-all duration-300 ${colorClass} ${isExpanded ? "ring-2 ring-white/10" : ""}`}>
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${colorClass.replace("from-", "bg-gradient-to-br from-").replace(" border", "")}`}>
                            <Layers size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">{cluster.label || `Cluster ${cluster.clusterId}`}</h3>
                            <p className="text-sm text-white/60 mt-1">
                                {cluster.size} items • Cluster {cluster.clusterId}
                                {typeof cluster.avgSimilarity === "number" && ` • Avg similarity: ${cluster.avgSimilarity.toFixed(3)}`}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-full bg-white/[0.15] text-white text-sm font-medium">
                        {cluster.size} items
                    </div>
                    <button
                        onClick={onToggle}
                        className="p-2 rounded-lg bg-white/[0.1] hover:bg-white/[0.15] transition-colors"
                    >
                        {isExpanded ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
                    </button>
                </div>
            </div>

            {/* Top Keywords */}
            {cluster.topKeywords && cluster.topKeywords.length > 0 && (
                <div className="mb-6">
                    <div className="text-sm text-white/70 mb-3 flex items-center gap-2">
                        <Tag size={14} />
                        Top Keywords
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {cluster.topKeywords.slice(0, 8).map((keyword, i) => (
                            <span
                                key={i}
                                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.15] text-white border border-white/[0.2]"
                            >
                                {keyword}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Representative Text */}
            {cluster.representativeText && (
                <div className="mb-6">
                    <div className="text-sm text-white/70 mb-3 flex items-center gap-2">
                        <Target size={14} />
                        Representative Text
                    </div>
                    <div className="rounded-xl border border-white/[0.1] bg-white/[0.05] p-4">
                        <p className="text-sm text-white/90 italic">"{clip(cluster.representativeText, 200)}"</p>
                    </div>
                </div>
            )}

            {/* Items in this cluster */}
            {isExpanded && (
                <div className="mt-6 pt-6 border-t border-white/[0.1] animate-in fade-in duration-300">
                    <div className="text-sm text-white/70 mb-4 flex items-center gap-2">
                        <Users size={14} />
                        Items in this Cluster ({items.length})
                    </div>
                    <div className="space-y-3">
                        {items.map((itemIndex, idx) => (
                            <div key={idx} className="rounded-xl border border-white/[0.1] bg-white/[0.05] p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="text-xs text-white/60">Item {itemIndex + 1}</div>
                                    <div className="text-xs px-2 py-1 rounded bg-white/[0.1] text-white/70">
                                        #{itemIndex + 1}
                                    </div>
                                </div>
                                <p className="text-sm text-white/80 line-clamp-3">{texts[itemIndex]}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ConfigurationCard({ title, value, description, icon: Icon, onChange, min, max, step = 1 }) {
    return (
        <div className="relative rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
                {Icon && (
                    <div className="p-2 rounded-lg bg-white/[0.08]">
                        <Icon size={16} className="text-white/70" />
                    </div>
                )}
                <div>
                    <div className="text-sm font-medium text-white/80">{title}</div>
                    <div className="text-xs text-white/60">{description}</div>
                </div>
            </div>
            <input
                type="number"
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-white text-center font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300"
            />
        </div>
    );
}

export default function ClustersAnalyzer() {
    const [raw, setRaw] = useState(
        [
            "Built an LLM retrieval pipeline; improved accuracy by 18% in Q1.",
            "Shipped eval harness changes; cut regressions by 22%.",
            "I leverage synergy and scalable paradigms to disrupt industries.",
            "Led stakeholder alignment and end-to-end value-add for scalable transformation.",
            "Implemented prompt tests, guardrails, and offline evaluation.",
        ].join("\n\n")
    );

    const [k, setK] = useState(3);
    const [seed, setSeed] = useState(42);
    const [maxIter, setMaxIter] = useState(25);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState("");
    const [expandedCluster, setExpandedCluster] = useState(null);

    const texts = useMemo(() => parseTexts(raw), [raw]);

    const itemsByCluster = useMemo(() => {
        const map = new Map();
        const assigns = result?.items || [];
        for (const a of assigns) {
            const c = a.clusterId;
            if (!map.has(c)) map.set(c, []);
            map.get(c).push(a.index);
        }
        return map;
    }, [result]);

    const clustersSorted = useMemo(() => {
        const clusters = result?.clusters || [];
        return [...clusters].sort((a, b) => (b.size || 0) - (a.size || 0));
    }, [result]);

    async function runClusters() {
        setError("");
        setResult(null);
        setCopied("");
        setExpandedCluster(null);

        if (texts.length < 2) {
            setError("Paste at least 2 texts (blank-line separated works best).");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/analyze/text/clusters`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texts,
                    k: Number(k) || 3,
                    seed: Number(seed) || 42,
                    max_iter: Number(maxIter) || 25,
                }),
            });

            if (!res.ok) {
                const msg = await res.text();
                throw new Error(`API ${res.status}: ${msg || "Request failed"}`);
            }

            const data = await res.json();
            if (!data.ok) throw new Error(data.error || "Clustering failed.");

            setResult(data);
            saveLastRun("clusters", {
                meta: { generatedAt: new Date().toISOString(), apiBase: API_BASE },
                input: {
                    texts,
                    k: Number(k) || 3,
                    seed: Number(seed) || 42,
                    max_iter: Number(maxIter) || 25,
                },
                output: data,
            });

        } catch (e) {
            setError(e?.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    async function onCopySummary() {
        setCopied("");
        if (!result?.ok) return;

        const summary = buildLinkedInSummary(result, texts);
        const ok = await copyToClipboard(summary);
        setCopied(ok ? "Summary copied to clipboard!" : "Copy failed (browser permissions).");
        setTimeout(() => setCopied(""), 2200);
    }

    function onDownloadJSON() {
        if (!result?.ok) return;

        downloadJSON("personalens-clusters-report", {
            meta: {
                generatedAt: new Date().toISOString(),
                apiBase: API_BASE,
                analyzer: "clusters",
                params: { k: Number(k) || 3, seed: Number(seed) || 42, max_iter: Number(maxIter) || 25 },
            },
            input: { count: texts.length, texts },
            output: result,
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
                                <Layers size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Semantic Clustering</h1>
                                <p className="text-white/70 mt-1">Group texts into persona themes using transformer embeddings</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-6">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Network size={16} />
                                <span>Uses k-means clustering on sentence embeddings</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Target size={16} />
                                <span>Automatic topic labeling</span>
                            </div>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => {
                            setRaw([
                                "Built an LLM retrieval pipeline; improved accuracy by 18% in Q1.",
                                "Shipped eval harness changes; cut regressions by 22%.",
                                "I leverage synergy and scalable paradigms to disrupt industries.",
                                "Led stakeholder alignment and end-to-end value-add for scalable transformation.",
                                "Implemented prompt tests, guardrails, and offline evaluation.",
                            ].join("\n\n"));
                            setResult(null);
                            setError("");
                            setCopied("");
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.1] bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
                    >
                        <RefreshCw size={16} />
                        Reset
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Input */}
                <div className="lg:col-span-2">
                    {/* Text Input */}
                    <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                        
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Input Texts</h3>
                                <p className="text-sm text-white/60">Separate entries with blank lines for best results</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-white/50">
                                <FileText size={12} />
                                <span>{texts.length} entries</span>
                            </div>
                        </div>

                        <textarea
                            value={raw}
                            onChange={(e) => {
                                setRaw(e.target.value);
                                setResult(null);
                                setError("");
                                setCopied("");
                            }}
                            placeholder={`Example text entry...\n\nAnother text entry...\n\nThird text entry...\n\nSeparate entries with blank lines for best results.`}
                            className="w-full h-64 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300 resize-none break-words whitespace-pre-wrap"
                            style={{ 
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word'
                            }}
                        />

                        <div className="mt-4 text-sm text-white/50">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={14} />
                                <span>Each blank-line separated block will be treated as one entry for clustering</span>
                            </div>
                        </div>
                    </div>

                    {/* Configuration */}
                    <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl mb-6">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Clustering Configuration</h3>
                                <p className="text-sm text-white/60">Adjust algorithm parameters for optimal results</p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/50">
                                k-means Algorithm
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ConfigurationCard
                                title="Number of Clusters (k)"
                                value={k}
                                description="Target number of clusters"
                                icon={Hash}
                                onChange={(e) => setK(e.target.value)}
                                min={2}
                                max={12}
                            />
                            <ConfigurationCard
                                title="Random Seed"
                                value={seed}
                                description="For reproducible results"
                                icon={Target}
                                onChange={(e) => setSeed(e.target.value)}
                            />
                            <ConfigurationCard
                                title="Max Iterations"
                                value={maxIter}
                                description="Algorithm iterations"
                                icon={TrendingUp}
                                onChange={(e) => setMaxIter(e.target.value)}
                                min={5}
                                max={100}
                                step={5}
                            />
                        </div>

                        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-white/60 flex-1">
                                <div className="flex items-center gap-2">
                                    <Brain size={14} />
                                    <span>Uses transformer embeddings with cosine similarity for clustering</span>
                                </div>
                            </div>

                            <button
                                onClick={runClusters}
                                disabled={loading || texts.length < 2}
                                className={`
                                    relative overflow-hidden rounded-xl px-6 py-3
                                    flex items-center justify-center gap-2
                                    ${texts.length >= 2
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
                                        <span>Clustering...</span>
                                    </>
                                ) : (
                                    <>
                                        <Activity size={18} />
                                        <span>Run Clustering</span>
                                        <Sparkles size={16} className="ml-1 opacity-60" />
                                    </>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="mt-6 rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 to-rose-600/10 p-4">
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={20} className="text-rose-400" />
                                    <div>
                                        <div className="font-medium text-rose-200">Analysis Error</div>
                                        <div className="text-sm text-rose-300/80 mt-1">{error}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clusters Results */}
                    {clustersSorted.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Layers size={20} className="text-cyan-400" />
                                Cluster Analysis Results
                            </h3>
                            <div className="space-y-6">
                                {clustersSorted.map((cluster, index) => (
                                    <ClusterCard
                                        key={cluster.clusterId}
                                        cluster={cluster}
                                        items={itemsByCluster.get(cluster.clusterId) || []}
                                        texts={texts}
                                        clusterIndex={index}
                                        isExpanded={expandedCluster === cluster.clusterId}
                                        onToggle={() => setExpandedCluster(expandedCluster === cluster.clusterId ? null : cluster.clusterId)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Results & Actions */}
                <div className="space-y-6">
                    {/* Summary Stats */}
                    <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <BarChart3 size={20} className="text-cyan-400" />
                                    Clustering Summary
                                </h3>
                                <p className="text-sm text-white/60 mt-1">Analysis overview and metrics</p>
                            </div>
                            {result?.embeddingModel && (
                                <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70">
                                    Model: {result.embeddingModel}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="text-center p-4 rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                    {result?.count || "—"}
                                </div>
                                <div className="text-sm text-white/60 mt-1">Texts Analyzed</div>
                            </div>
                            <div className="text-center p-4 rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                                <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    {result?.k || "—"}
                                </div>
                                <div className="text-sm text-white/60 mt-1">Clusters</div>
                            </div>
                            <div className="text-center p-4 rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                    {seed}
                                </div>
                                <div className="text-sm text-white/60 mt-1">Random Seed</div>
                            </div>
                            <div className="text-center p-4 rounded-xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                                <div className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                                    {maxIter}
                                </div>
                                <div className="text-sm text-white/60 mt-1">Max Iterations</div>
                            </div>
                        </div>

                        {result?.clusters?.length > 0 && (
                            <div>
                                <div className="text-sm text-white/70 mb-3">Cluster Distribution</div>
                                <div className="space-y-3">
                                    {clustersSorted.map((cluster, index) => {
                                        const percentage = ((cluster.size / result.count) * 100).toFixed(1);
                                        const colorClass = [
                                            "from-cyan-500 to-blue-500",
                                            "from-purple-500 to-pink-500",
                                            "from-emerald-500 to-teal-500",
                                            "from-amber-500 to-orange-500",
                                            "from-rose-500 to-red-500"
                                        ][index % 5];

                                        return (
                                            <div key={cluster.clusterId} className="flex items-center gap-3">
                                                <div className="w-24 text-sm text-white/70 truncate">
                                                    {cluster.label || `Cluster ${cluster.clusterId}`}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-xs text-white/60 mb-1">
                                                        <span>{cluster.size} items</span>
                                                        <span>{percentage}%</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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
                                        <div className="text-xs text-white/50">Complete clustering data</div>
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
                                    <Sparkles size={16} className="text-emerald-400" />
                                    <div className="text-sm text-emerald-300">{copied}</div>
                                </div>
                            </div>
                        )}
                    </div>

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
                                        result: result ?? null,
                                        api: `${API_BASE}/analyze/text/clusters`
                                    }, 
                                    null, 2
                                )}
                            </pre>
                        </div>
                    </div>

                    {/* API Status */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="text-xs text-white/50">
                            <div className="font-medium text-white/70 mb-1">API Endpoint</div>
                            <code className="block truncate rounded bg-black/30 px-3 py-2 font-mono text-[11px]">
                                POST {API_BASE}/analyze/text/clusters
                            </code>
                            <div className="flex items-center gap-2 mt-3">
                                <div className={`w-2 h-2 rounded-full ${result ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                                <span>{result ? "Clustering complete" : "Ready for analysis"}</span>
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
                        <span>Clustering groups texts by semantic similarity using transformer embeddings. It surfaces thematic patterns for exploration, not deception detection or truth verification.</span>
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