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
    lines.push(`Text A (preview): “${clip(a, 170)}”`);
    if (aTags) lines.push(`A signals: ${aTags}`);
    if (aKw) lines.push(`A keywords: ${aKw}`);
    lines.push("");
    lines.push(`Text B (preview): “${clip(b, 170)}”`);
    if (bTags) lines.push(`B signals: ${bTags}`);
    if (bKw) lines.push(`B keywords: ${bKw}`);
    lines.push("");
    lines.push("Notes: This is not fact-checking. It surfaces semantic distance + lightweight linguistic signals.");
    lines.push("Repo: PersonaLens (FastAPI + Next.js) • Tabs: Single Text / Drift / Timeline / Clusters");

    return lines.join("\n");
}

export default function DriftAnalyzer() {
    const [a, setA] = useState(
        "Built an LLM retrieval pipeline; improved answer accuracy by 18% in Q1."
    );
    const [b, setB] = useState(
        "I leverage synergy and scalable paradigms to disrupt industries."
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [drift, setDrift] = useState(null);
    const [reasons, setReasons] = useState(null);
    const [reasonsError, setReasonsError] = useState("");

    const [copied, setCopied] = useState("");

    const canRun = useMemo(() => a.trim().length >= 20 && b.trim().length >= 20, [a, b]);

    async function fetchDrift(textA, textB) {
        // Try common payload shapes to stay compatible with your API evolution
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

            // Optional but nice: attach reason tags/keywords for each text
            await fetchReasons([a.trim(), b.trim()]);
        } catch (e) {
            setError(e?.message || "Unknown error");
        } finally {
            setLoading(false);
        }

        const d = await fetchDrift(a.trim(), b.trim());
        setDrift(d);

        const reasonsData = await fetchReasons([a.trim(), b.trim()]);

        saveLastRun("drift", {
            meta: { generatedAt: new Date().toISOString(), apiBase: API_BASE },
            input: { a: a.trim(), b: b.trim() },
            output: { drift: d, reasons: reasonsData },
        });

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

        setCopied(ok ? "Copied summary to clipboard." : "Copy failed (browser permissions).");
        setTimeout(() => setCopied(""), 2200);
    }

    return (
        <section className="mx-auto w-full max-w-5xl">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
                    <p className="text-sm leading-relaxed text-white/70">
                        Drift mode: compare two texts using transformer embeddings. Higher drift means the meaning moves further.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    {/* Left */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs font-medium text-white/70">Text A</div>
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
                            className="mt-2 h-40 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                        />

                        <div className="mt-4 text-xs font-medium text-white/70">Text B</div>
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
                            className="mt-2 h-40 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                        />

                        <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-white/55">API: {API_BASE}</div>
                            <button
                                onClick={run}
                                disabled={loading || !canRun}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? "Analyzing..." : "Compute Drift"}
                            </button>
                        </div>

                        {error ? (
                            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                                {error}
                            </div>
                        ) : null}
                    </div>

                    {/* Right */}
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-medium text-white/70">Drift result</div>
                                <div className="text-xs text-white/55">
                                    {drift?.embeddingModel ? `Model: ${drift.embeddingModel}` : "—"}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 justify-end">
                                <button
                                    onClick={onDownloadJSON}
                                    disabled={!drift?.ok}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Download JSON
                                </button>
                                <button
                                    onClick={onCopySummary}
                                    disabled={!drift?.ok}
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
                                <Pill label="Similarity" value={drift?.similarity ?? "—"} />
                                <Pill label="Drift" value={drift?.driftScore ?? "—"} />
                            </div>

                            <div className="mt-3 text-[11px] text-white/50">
                                Drift is computed as (1 - similarity) if not provided by the API.
                            </div>
                        </div>

                        {reasonsError ? (
                            <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                                {reasonsError}
                            </div>
                        ) : null}

                        {/* Reason tags / keywords */}
                        <div className="mt-4 grid grid-cols-1 gap-3">
                            {[0, 1].map((idx) => {
                                const it = (reasons?.items || []).find((x) => x.index === idx);
                                const title = idx === 0 ? "Text A signals" : "Text B signals";
                                const tags = it?.reasonTags || [];
                                const kw = it?.keywords || [];
                                const sig = it?.signals;

                                return (
                                    <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs font-medium text-white/70">{title}</div>
                                            <div className="text-[11px] text-white/50">
                                                {sig ? `words ${sig.wordCount} • metrics ${sig.metricHits} • buzz ${sig.buzzwordHits}` : "—"}
                                            </div>
                                        </div>

                                        {tags.length ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {tags.map((t, i) => (
                                                    <span
                                                        key={i}
                                                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/75"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-2 text-xs text-white/55">Run drift to fetch tags.</div>
                                        )}

                                        {kw.length ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {kw.map((k, i) => (
                                                    <span
                                                        key={i}
                                                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-white/60"
                                                    >
                                                        {k}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Debug */}
                        <div className="mt-4">
                            <div className="text-xs font-medium text-white/70">Raw response (debug)</div>
                            <pre className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                                {JSON.stringify({ drift: drift?.raw ?? drift ?? null, reasons: reasons ?? null }, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
