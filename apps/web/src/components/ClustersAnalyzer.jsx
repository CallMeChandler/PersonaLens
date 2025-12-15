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
    lines.push(`What it does: groups posts/snippets into semantic “persona themes” using sentence-transformer embeddings + k-means (cosine).`);
    lines.push(`Run stats: ${result.count} texts • k=${result.k} • model=${result.embeddingModel}`);
    lines.push("");

    lines.push("Top clusters:");
    for (const c of top) {
        const kws = (c.topKeywords || []).slice(0, 3).join(", ");
        lines.push(`- ${c.label} (${c.size}) • keywords: ${kws}`);
        if (typeof c.representativeIndex === "number") {
            lines.push(`  rep: “${clip(texts[c.representativeIndex], 140)}”`);
        }
    }

    lines.push("");
    lines.push("Notes: This is not fact-checking. It surfaces semantic structure and consistency signals in your content.");
    lines.push("");
    lines.push("Repo: PersonaLens (FastAPI + Next.js) • Tabs: Single Text signals / Drift / Timeline Drift / Clusters");

    return lines.join("\n");
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
        setCopied(ok ? "Copied summary to clipboard." : "Copy failed (browser permissions).");
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
        <section className="mx-auto w-full max-w-5xl">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
                    <p className="text-sm leading-relaxed text-white/70">
                        Clusters mode: groups your posts/snippets into semantic topic buckets using transformer embeddings + k-means (cosine).
                        This helps show “persona themes” at a glance.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Left: input */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <label className="mb-2 block text-xs font-medium text-white/70">
                            Paste texts (separate entries with a blank line)
                        </label>

                        <textarea
                            value={raw}
                            onChange={(e) => {
                                setRaw(e.target.value);
                                setResult(null);
                                setError("");
                                setCopied("");
                            }}
                            placeholder={"Text A...\n\nText B...\n\nText C..."}
                            className="h-72 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                        />

                        <div className="mt-3 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="text-[11px] text-white/60">k (clusters)</div>
                                <input
                                    type="number"
                                    min={2}
                                    max={12}
                                    value={k}
                                    onChange={(e) => setK(e.target.value)}
                                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="text-[11px] text-white/60">seed</div>
                                <input
                                    type="number"
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value)}
                                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                                <div className="text-[11px] text-white/60">max_iter</div>
                                <input
                                    type="number"
                                    min={5}
                                    max={100}
                                    value={maxIter}
                                    onChange={(e) => setMaxIter(e.target.value)}
                                    className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-white/20"
                                />
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-white/55">
                                {texts.length} entries • API: {API_BASE}
                            </div>
                            <button
                                onClick={runClusters}
                                disabled={loading}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Clustering..." : "Run Clusters"}
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
                                <div className="text-xs font-medium text-white/70">Cluster results</div>
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
                                <Pill label="k" value={result?.k ?? "—"} />
                                <Pill label="seed" value={result?.seed ?? "—"} />
                            </div>

                            <div className="mt-3 text-[11px] text-white/50">
                                Clusters are labeled using extracted keywords from a representative text (not an LLM-generated summary).
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                            {clustersSorted.length ? (
                                clustersSorted.map((c) => {
                                    const idxs = itemsByCluster.get(c.clusterId) || [];
                                    return (
                                        <div key={c.clusterId} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {c.label || `Cluster ${c.clusterId}`}
                                                    </div>
                                                    <div className="mt-1 text-xs text-white/55">
                                                        Cluster {c.clusterId} • {c.size} items
                                                        {typeof c.avgSimilarity === "number" ? ` • avg sim ${c.avgSimilarity}` : ""}
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {(c.topKeywords || []).slice(0, 6).map((kword, i) => (
                                                        <span
                                                            key={i}
                                                            className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/70"
                                                        >
                                                            {kword}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <div className="text-xs font-medium text-white/70">Representative</div>
                                                <div className="mt-1 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75">
                                                    {c.representativeText || "—"}
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <div className="text-xs font-medium text-white/70">Items in this cluster</div>
                                                <div className="mt-2 flex flex-col gap-2">
                                                    {idxs.map((i) => (
                                                        <div key={i} className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                                                            <div className="mb-1 text-[11px] text-white/45">Item {i + 1}</div>
                                                            <div className="line-clamp-3">{texts[i] || "—"}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/55">
                                    Run clustering to see topic buckets.
                                </div>
                            )}
                        </div>

                        <div className="mt-4">
                            <div className="text-xs font-medium text-white/70">Raw response (debug)</div>
                            <pre className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                                {JSON.stringify(result ?? { note: "No result yet." }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
