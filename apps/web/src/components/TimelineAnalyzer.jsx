"use client";

import React, { useMemo, useState } from "react";
import { downloadJSON, copyToClipboard, clip } from "@/lib/reportUtils";
import { saveLastRun } from "@/lib/reportVault";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function Pill({ label, value }) {
    return (
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
            <span className="text-white/60">{label}: </span>
            <span className="font-semibold text-white">{value}</span>
        </div>
    );
}

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

function MiniLineChart({ values = [], labels = [], highlight = [] }) {
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
                className="w-full min-w-[520px] rounded-2xl border border-white/10 bg-black/30"
            >
                <line
                    x1={pad}
                    y1={height - pad}
                    x2={width - pad}
                    y2={height - pad}
                    stroke="rgba(255,255,255,0.10)"
                />
                <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.10)" />

                <polyline
                    fill="none"
                    stroke="rgba(255,255,255,0.70)"
                    strokeWidth="2"
                    points={polyline}
                />

                {pts.map((p) => {
                    const isHot = highlight?.[p.i];
                    return (
                        <circle
                            key={p.i}
                            cx={p.x}
                            cy={p.y}
                            r={4.2}
                            fill={isHot ? "rgba(248,113,113,0.95)" : "rgba(255,255,255,0.85)"}
                            stroke="rgba(0,0,0,0.25)"
                            strokeWidth="1"
                        />
                    );
                })}
            </svg>

            {labels?.length ? (
                <div className="mt-2 flex min-w-[520px] justify-between gap-2 text-[11px] text-white/55">
                    <div>{labels[0]}</div>
                    <div className="text-white/35">…</div>
                    <div>{labels[labels.length - 1]}</div>
                </div>
            ) : null}
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
            lines.push(`Example outlier snippet: “${clip(sample, 180)}”`);
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
        setCopied(ok ? "Copied summary to clipboard." : "Copy failed (browser permissions).");
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
        <section className="mx-auto w-full max-w-5xl">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
                    <p className="text-sm leading-relaxed text-white/70">
                        Timeline mode: enter dated posts/snippets. We compute transformer-based drift between adjacent posts and
                        rolling-window drift to surface narrative instability and outliers.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Left: inputs */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                            <div className="text-xs font-medium text-white/70">Paste LinkedIn dump (quick import)</div>
                            <div className="mt-1 text-[11px] text-white/50">
                                Format per line: <span className="text-white/70">YYYY-MM-DD - text</span> (also supports | : —)
                            </div>
                            <textarea
                                value={bulkDump}
                                onChange={(e) => setBulkDump(e.target.value)}
                                placeholder={`2024-01-10 - Built an LLM retrieval pipeline; improved answer accuracy by 18%.\n2024-03-05 | Shipped an agentic workflow; reduced response time by 35%.`}
                                className="mt-2 h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                            />
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <div className="text-[11px] text-white/45">{bulkInfo}</div>
                                <button
                                    onClick={importBulk}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
                                >
                                    Import
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="text-xs font-medium text-white/70">Dated items</div>
                            <button
                                onClick={addRow}
                                className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
                            >
                                + Add
                            </button>
                        </div>

                        <div className="mt-3 flex flex-col gap-3">
                            {items.map((it, i) => {
                                const showRemove = items.length > 2;
                                const isOutlier = outlierUISet.has(i);

                                return (
                                    <div
                                        key={i}
                                        className={`rounded-2xl border p-3 ${isOutlier ? "border-red-500/40 bg-red-500/10" : "border-white/10 bg-black/30"
                                            }`}
                                    >
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="text-xs text-white/70">
                                                Item {i + 1} {isOutlier ? <span className="text-red-200">(outlier)</span> : null}
                                            </div>

                                            {showRemove ? (
                                                <button onClick={() => removeRow(i)} className="text-xs text-white/55 hover:text-white">
                                                    Remove
                                                </button>
                                            ) : null}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            <input
                                                type="date"
                                                value={it.date}
                                                onChange={(e) => updateItem(i, { date: e.target.value })}
                                                className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                            />
                                            <textarea
                                                value={it.text}
                                                onChange={(e) => updateItem(i, { text: e.target.value })}
                                                placeholder="Paste the post/snippet for this date…"
                                                className="h-24 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="text-[11px] text-white/60">Window size</div>
                                <input
                                    type="number"
                                    min={2}
                                    value={windowSize}
                                    onChange={(e) => setWindowSize(e.target.value)}
                                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="text-[11px] text-white/60">Stride</div>
                                <input
                                    type="number"
                                    min={1}
                                    value={stride}
                                    onChange={(e) => setStride(e.target.value)}
                                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-white/55">API: {API_BASE}</div>
                            <button
                                onClick={runTimeline}
                                disabled={loading}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Analyzing..." : "Compute Timeline"}
                            </button>
                        </div>

                        {error ? (
                            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                {error}
                            </div>
                        ) : null}
                    </div>

                    {/* Right: results */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-medium text-white/70">Timeline result</div>
                                <div className="text-xs text-white/55">
                                    {result?.embeddingModel ? `Model: ${result.embeddingModel}` : "—"}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-end">
                                <button
                                    onClick={onDownloadJSON}
                                    disabled={!result?.ok}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Download JSON
                                </button>
                                <button
                                    onClick={onCopySummary}
                                    disabled={!result?.ok}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Copy LinkedIn Summary
                                </button>
                            </div>
                        </div>

                        {copied ? (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
                                {copied}
                            </div>
                        ) : null}

                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="flex flex-wrap gap-2">
                                <Pill label="Items" value={result?.count ?? "—"} />
                                <Pill label="Window" value={result?.window ?? "—"} />
                                <Pill label="Stride" value={result?.stride ?? "—"} />
                                <Pill label="Outlier posts" value={outlierPayloadIndices.length} />
                            </div>

                            <div className="mt-4">
                                <div className="text-xs font-medium text-white/70">Rolling window drift trend</div>
                                <div className="mt-2">
                                    {result?.windows?.length ? (
                                        <MiniLineChart values={windowDrifts} labels={windowLabels} highlight={windowHighlights} />
                                    ) : (
                                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
                                            Click “Compute Timeline” to see the drift trend.
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 text-[11px] text-white/45">
                                    Points highlighted in red indicate windows that contain at least one outlier post.
                                </div>
                            </div>
                        </div>

                        {/* Outlier Reasons (API-backed) */}
                        <div className="mt-4">
                            <div className="text-xs font-medium text-white/70">Outlier reasons (API)</div>

                            {reasonsError ? (
                                <div className="mt-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                                    {reasonsError}
                                </div>
                            ) : null}

                            <div className="mt-2 flex flex-col gap-2">
                                {result && outlierPayloadIndices.length ? (
                                    outlierPayloadIndices.map((payloadIdx) => {
                                        const uiIdx = indexMap[payloadIdx];
                                        const reasonItem = reasonsByIndex.get(payloadIdx);

                                        const uiDate =
                                            typeof uiIdx === "number"
                                                ? items?.[uiIdx]?.date || result?.dates?.[payloadIdx] || "—"
                                                : result?.dates?.[payloadIdx] || "—";

                                        const uiText = typeof uiIdx === "number" ? (items?.[uiIdx]?.text || "").trim() : "";

                                        const sig = reasonItem?.signals;
                                        const tags = reasonItem?.reasonTags || [];
                                        const keywords = reasonItem?.keywords || [];
                                        const sim = reasonItem?.semanticSimilarityToCentroid;

                                        return (
                                            <div key={payloadIdx} className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-red-100">
                                                        Item {typeof uiIdx === "number" ? uiIdx + 1 : payloadIdx + 1} • {uiDate}
                                                    </div>
                                                    <div className="text-[11px] text-red-100/70">
                                                        {sig
                                                            ? `words ${sig.wordCount} • metrics ${sig.metricHits} • buzz ${sig.buzzwordHits}`
                                                            : "—"}
                                                        {typeof sim === "number" ? ` • sim ${sim}` : ""}
                                                    </div>
                                                </div>

                                                <div className="mt-2 text-xs text-red-50/90 line-clamp-3">{uiText || "—"}</div>

                                                {tags.length ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {tags.map((t, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="rounded-full border border-red-200/20 bg-black/20 px-3 py-1 text-[11px] text-red-50/90"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}

                                                {keywords.length ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {keywords.map((k, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70"
                                                            >
                                                                {k}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
                                        No outliers flagged yet (or no result). Compute timeline first.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pairwise drift */}
                        <div className="mt-4">
                            <div className="text-xs font-medium text-white/70">Pairwise drift (adjacent posts)</div>
                            <div className="mt-2 flex flex-col gap-2">
                                {(result?.pairwise || []).map((p, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70"
                                    >
                                        <div className="text-white/60">
                                            {p.fromDate} → {p.toDate}
                                        </div>
                                        <div className="font-semibold text-white">
                                            drift {p.driftScore} (sim {p.similarity})
                                        </div>
                                    </div>
                                ))}

                                {!result ? (
                                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
                                        No result yet.
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Debug */}
                        <div className="mt-4">
                            <div className="text-xs font-medium text-white/70">Raw response (debug)</div>
                            <pre className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                                {JSON.stringify({ timeline: result ?? null, reasons: reasons ?? null }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
