"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON, copyToClipboard, clip } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";
import {
    GitCompare,
    TrendingUp,
    TrendingDown,
    ArrowRightLeft,
    Download,
    Copy,
    AlertTriangle,
    CheckCircle,
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
    GitBranch
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function normalizeDriftResponse(data) {
    if (!data) return { ok: false, error: "Empty response" };

    const ok = data.ok ?? true;

    const similarity =
        data.similarity ??
        data.sim ??
        data.cosineSimilarity ??
        data.score ??
        null;

    const driftScore =
        data.driftScore ??
        data.drift ??
        (typeof similarity === "number" ? Number((1 - similarity).toFixed(4)) : null);

    const embeddingModel =
        data.embeddingModel ??
        data.model ??
        null;

    return {
        ok: !!ok,
        similarity: typeof similarity === "number" ? similarity : null,
        driftScore: typeof driftScore === "number" ? driftScore : null,
        embeddingModel,
        raw: data,
    };
}

function buildLinkedInSummary({ drift, reasons, a, b }) {
    if (!drift?.ok) return "";

    const rByIdx = new Map();
    for (const it of reasons?.items || []) rByIdx.set(it.index, it);

    const ra = rByIdx.get(0);
    const rb = rByIdx.get(1);

    const aTags = (ra?.reasonTags || []).slice(0, 4).join(" • ");
    const bTags = (rb?.reasonTags || []).slice(0, 4).join(" • ");
    const aKw = (ra?.keywords || []).slice(0, 6).join(", ");
    const bKw = (rb?.keywords || []).slice(0, 6).join(", ");

    const lines = [];
    lines.push("PersonaLens: semantic drift between two texts (transformer embeddings)");
    lines.push("");
    lines.push(
        `What it does: computes embedding similarity and a drift score (1 - similarity) to quantify how much two statements/posts differ semantically.`
    );
    lines.push(
        `Run stats: model=${drift.embeddingModel || "—"} • similarity=${drift.similarity ?? "—"} • drift=${drift.driftScore ?? "—"}`
    );
    lines.push("");
    lines.push(`Text A (preview): "${clip(a, 170)}"`);
    if (aTags) lines.push(`A signals: ${aTags}`);
    if (aKw) lines.push(`A keywords: ${aKw}`);
    lines.push("");
    lines.push(`Text B (preview): "${clip(b, 170)}"`);
    if (bTags) lines.push(`B signals: ${bTags}`);
    if (bKw) lines.push(`B keywords: ${bKw}`);
    lines.push("");
    lines.push("Notes: This is not fact-checking. It surfaces semantic distance + lightweight linguistic signals.");
    lines.push("Repo: PersonaLens (FastAPI + Next.js) • Tabs: Single Text / Drift / Timeline / Clusters");

    return lines.join("\n");
}

function DriftScoreCard({ similarity, driftScore, model }) {
    const getDriftLevel = (score) => {
        if (!score && score !== 0) return null;
        if (score < 0.3) return { label: "Low Drift", color: "from-emerald-500 to-teal-500", icon: CheckCircle };
        if (score < 0.6) return { label: "Moderate Drift", color: "from-amber-500 to-orange-500", icon: AlertTriangle };
        return { label: "High Drift", color: "from-rose-500 to-red-500", icon: TrendingDown };
    };

    const similarityPercent = similarity != null ? Math.round(similarity * 100) : null;
    const driftLevel = driftScore != null ? getDriftLevel(driftScore) : null;

    return (
        <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <GitCompare size={20} className="text-cyan-400" />
                        Semantic Drift Analysis
                    </h3>
                    <p className="text-sm text-white/60 mt-1">Transformer embeddings comparison</p>
                </div>
                {model && (
                    <div className="px-3 py-1 rounded-full bg-white/[0.08] text-xs text-white/70">
                        Model: {model}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-white/70">Semantic Similarity</div>
                            <div className="text-xs text-white/50">Higher = more alike</div>
                        </div>
                        <div className="relative">
                            <div className="h-3 w-full rounded-full bg-white/[0.08] overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
                                    style={{ width: `${similarityPercent || 0}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 px-1">
                                <span className="text-xs text-white/40">0%</span>
                                <span className="text-xs text-white/40">50%</span>
                                <span className="text-xs text-white/40">100%</span>
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                                {similarityPercent != null ? `${similarityPercent}%` : "—"}
                            </div>
                            <div className="text-sm text-white/60 mt-1">Raw: {similarity != null ? similarity.toFixed(4) : "—"}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm text-white/70">Drift Score</div>
                            <div className="text-xs text-white/50">Higher = more different</div>
                        </div>
                        <div className="relative">
                            <div className="h-3 w-full rounded-full bg-white/[0.08] overflow-hidden">
                                {driftScore != null && (
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${driftLevel?.color || "from-gray-500 to-gray-600"} transition-all duration-1000`}
                                        style={{ width: `${(driftScore || 0) * 100}%` }}
                                    />
                                )}
                            </div>
                            <div className="flex justify-between mt-2 px-1">
                                <span className="text-xs text-white/40">Identical</span>
                                <span className="text-xs text-white/40">Different</span>
                                <span className="text-xs text-white/40">Unrelated</span>
                            </div>
                        </div>
                        <div className="mt-4 text-center">
                            {driftScore != null ? (
                                <>
                                    <div className="text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent" style={{
                                        backgroundImage: (driftLevel?.color || "from-gray-500 to-gray-600").replace("from-", "linear-gradient(to right, ").replace("to-", ", ")
                                    }}>
                                        {driftScore.toFixed(4)}
                                    </div>
                                    {driftLevel && (
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <driftLevel.icon size={16} className={driftLevel.color.includes("emerald") ? "text-emerald-400" : driftLevel.color.includes("amber") ? "text-amber-400" : "text-rose-400"} />
                                            <span className="text-sm text-white/60">{driftLevel.label}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-4xl font-bold text-white/40">—</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/[0.1]">
                <div className="text-xs text-white/50">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft size={12} />
                        <span>Drift = 1 - Similarity. Measures semantic distance between embeddings.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TextSignalCard({ index, text, reasons, title }) {
    const item = (reasons?.items || []).find(x => x.index === index);
    const tags = item?.reasonTags || [];
    const keywords = item?.keywords || [];
    const signals = item?.signals;

    return (
        <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="flex items-start justify-between mb-6">
                <div className="flex-1 min-w-0 mr-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${index === 0 ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                            {index === 0 ? <FileText size={18} className="text-blue-400" /> : <Copy size={18} className="text-purple-400" />}
                        </div>
                        {title}
                    </h3>
                    <p className="text-sm text-white/60 mt-1 truncate max-w-full">"{clip(text, 120)}"</p>
                </div>
                {signals && (
                    <div className="text-right flex-shrink-0">
                        <div className="text-xs text-white/70">Signals</div>
                        <div className="text-sm font-medium text-white">{signals.wordCount} words</div>
                    </div>
                )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
                <div className="mb-6">
                    <div className="text-sm text-white/70 mb-3">Linguistic Signals</div>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag, i) => (
                            <span
                                key={i}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium ${index === 0 ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"}`}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Keywords */}
            {keywords.length > 0 && (
                <div>
                    <div className="text-sm text-white/70 mb-3">Key Terms</div>
                    <div className="flex flex-wrap gap-2">
                        {keywords.slice(0, 8).map((keyword, i) => (
                            <span
                                key={i}
                                className="px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/70 text-xs border border-white/[0.1]"
                            >
                                {keyword}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {tags.length === 0 && keywords.length === 0 && (
                <div className="text-center py-8 text-white/50">
                    <Filter size={24} className="mx-auto mb-3 opacity-40" />
                    <p>Run analysis to extract signals and keywords</p>
                </div>
            )}
        </div>
    );
}

export default function DriftAnalyzer() {
    const [a, setA] = useState(
        "Built an LLM retrieval pipeline..."
    );
    const [b, setB] = useState(
        "I leverage synergy..."
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [drift, setDrift] = useState(null);
    const [reasons, setReasons] = useState(null);
    const [reasonsError, setReasonsError] = useState("");

    const [copied, setCopied] = useState("");

    const canRun = useMemo(() => a.trim().length >= 20 && b.trim().length >= 20, [a, b]);

    async function fetchDrift(textA, textB) {
        const attempts = [
            { a: textA, b: textB },
            { textA, textB },
            { left: textA, right: textB },
            { texts: [textA, textB] },
        ];

        let lastErr = null;

        for (const body of attempts) {
            try {
                const res = await fetch(`${API_BASE}/analyze/text/drift`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });

                if (!res.ok) {
                    const msg = await res.text();
                    lastErr = new Error(`Drift API ${res.status}: ${msg || "Request failed"}`);
                    continue;
                }

                const data = await res.json();
                const norm = normalizeDriftResponse(data);

                if (!norm.ok) {
                    lastErr = new Error(norm.error || "Drift analysis failed.");
                    continue;
                }

                return norm;
            } catch (e) {
                lastErr = e;
            }
        }

        throw lastErr || new Error("Drift request failed.");
    }

    async function fetchReasons(texts) {
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

    async function run() {
        setError("");
        setCopied("");
        setDrift(null);
        setReasons(null);
        setReasonsError("");

        if (!canRun) {
            setError("Both texts should be at least ~20 characters for stable signals.");
            return;
        }

        setLoading(true);
        try {
            const d = await fetchDrift(a.trim(), b.trim());
            setDrift(d);

            await fetchReasons([a.trim(), b.trim()]);

            saveLastRun("drift", {
                meta: { generatedAt: new Date().toISOString(), apiBase: API_BASE },
                input: { a: a.trim(), b: b.trim() },
                output: { drift: d, reasons },
            });
        } catch (e) {
            setError(e?.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    function onDownloadJSON() {
        if (!drift?.ok) return;

        downloadJSON("personalens-drift-report", {
            meta: {
                generatedAt: new Date().toISOString(),
                apiBase: API_BASE,
                analyzer: "drift",
            },
            input: { a: a.trim(), b: b.trim() },
            output: { drift, reasons: reasons ?? null },
        });
    }

    async function onCopySummary() {
        setCopied("");
        if (!drift?.ok) return;

        const summary = buildLinkedInSummary({ drift, reasons, a: a.trim(), b: b.trim() });
        const ok = await copyToClipboard(summary);

        setCopied(ok ? "Summary copied to clipboard!" : "Copy failed (browser permissions).");
        setTimeout(() => setCopied(""), 2200);
    }

    return (
        <div className="relative">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                                <GitCompare size={24} className="text-cyan-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Semantic Drift Analysis</h1>
                                <p className="text-white/70 mt-1">Compare embedding similarity between two texts</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-6">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Brain size={16} />
                                <span>Uses transformer embeddings for semantic comparison</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Target size={16} />
                                <span>Drift = 1 - Similarity</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setA("");
                            setB("");
                            setDrift(null);
                            setReasons(null);
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Text A Input */}
                        <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <FileText size={18} className="text-blue-400" />
                                    </div>
                                    Text A
                                </h3>
                                <div className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">
                                    Baseline
                                </div>
                            </div>
                            <textarea
                                value={a}
                                onChange={(e) => {
                                    setA(e.target.value);
                                    setError("");
                                    setCopied("");
                                    setDrift(null);
                                    setReasons(null);
                                    setReasonsError("");
                                }}
                                className="w-full h-48 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-300 resize-none overflow-auto break-words whitespace-pre-wrap"
                                placeholder="Enter baseline text (e.g., factual statement, original post)..."
                                style={{ 
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word'
                                }}
                            />
                            <div className="mt-4 text-xs text-white/50">
                                {a.length >= 20 ? (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <CheckCircle size={12} />
                                        Ready for analysis
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-amber-400">
                                        <AlertCircle size={12} />
                                        {20 - a.length} more characters needed
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Text B Input */}
                        <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                        <Copy size={18} className="text-purple-400" />
                                    </div>
                                    Text B
                                </h3>
                                <div className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">
                                    Comparison
                                </div>
                            </div>
                            <textarea
                                value={b}
                                onChange={(e) => {
                                    setB(e.target.value);
                                    setError("");
                                    setCopied("");
                                    setDrift(null);
                                    setReasons(null);
                                    setReasonsError("");
                                }}
                                className="w-full h-48 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/30 transition-all duration-300 resize-none overflow-auto break-words whitespace-pre-wrap"
                                placeholder="Enter comparison text (e.g., modified statement, new post)..."
                                style={{ 
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word'
                                }}
                            />
                            <div className="mt-4 text-xs text-white/50">
                                {b.length >= 20 ? (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <CheckCircle size={12} />
                                        Ready for analysis
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-amber-400">
                                        <AlertCircle size={12} />
                                        {20 - b.length} more characters needed
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1">
                                <div className="text-sm text-white/60">
                                    <div className="flex items-center gap-2">
                                        <GitBranch size={14} />
                                        <span>Compare semantic distance using transformer embeddings</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={run}
                                    disabled={loading || !canRun}
                                    className={`
                                        relative overflow-hidden rounded-xl px-6 py-3
                                        flex items-center justify-center gap-2
                                        ${canRun
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
                                            <span>Analyzing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Activity size={18} />
                                            <span>Compute Drift</span>
                                            <Sparkles size={16} className="ml-1 opacity-60" />
                                        </>
                                    )}
                                </button>
                            </div>
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

                    {/* Text Signals */}
                    <div className="mt-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Filter size={20} className="text-cyan-400" />
                            Text Signal Analysis
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <TextSignalCard
                                index={0}
                                text={a}
                                reasons={reasons}
                                title="Text A Signals"
                            />
                            <TextSignalCard
                                index={1}
                                text={b}
                                reasons={reasons}
                                title="Text B Signals"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column - Results */}
                <div className="space-y-6">
                    <DriftScoreCard
                        similarity={drift?.similarity}
                        driftScore={drift?.driftScore}
                        model={drift?.embeddingModel}
                    />

                    {/* Actions */}
                    <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Download size={20} className="text-cyan-400" />
                            Export & Share
                        </h3>

                        <div className="space-y-3">
                            <button
                                onClick={onDownloadJSON}
                                disabled={!drift?.ok}
                                className={`
                                    w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                                    transition-all duration-300
                                    ${drift?.ok
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

                            <button
                                onClick={onCopySummary}
                                disabled={!drift?.ok}
                                className={`
                                    w-full flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] px-4 py-3 text-sm
                                    transition-all duration-300
                                    ${drift?.ok
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
                                        <div className="text-xs text-white/50">Formatted analysis notes</div>
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
                                        drift: drift?.raw ?? drift ?? null,
                                        reasons: reasons ?? null,
                                        api: `${API_BASE}/analyze/text/drift`
                                    },
                                    null, 2
                                )}
                            </pre>
                        </div>
                    </div>

                    {/* API Status */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="text-xs text-white/50">
                            <div className="font-medium text-white/70 mb-1">API Endpoints</div>
                            <div className="space-y-2">
                                <code className="block truncate rounded bg-black/30 px-3 py-2 font-mono text-[11px]">
                                    POST {API_BASE}/analyze/text/drift
                                </code>
                                <code className="block truncate rounded bg-black/30 px-3 py-2 font-mono text-[11px]">
                                    POST {API_BASE}/analyze/text/reasons
                                </code>
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
                        <span>Drift analysis measures semantic distance using transformer embeddings. It does not assess factual accuracy, truthfulness, or intent.</span>
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