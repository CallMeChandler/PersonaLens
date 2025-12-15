"use client";

import React, { useMemo, useState } from "react";

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

export default function DriftAnalyzer() {
  const [texts, setTexts] = useState([
    "I built an end-to-end GenAI agent for customer support, reducing response times by 35%.",
    "Shipped LLM-based retrieval and evaluation pipelines; improved deflection by 22% in Q2 2024.",
    "Passionate about synergy and disruption. I leverage scalable paradigms to transform industries.",
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const cleaned = useMemo(
    () => texts.map((t) => (t || "").trim()).filter(Boolean),
    [texts]
  );

  const outlierSet = useMemo(() => {
    const idxs = result?.outlierIndices || [];
    return new Set(idxs);
  }, [result]);

  function updateText(i, v) {
    setTexts((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function addText() {
    setTexts((prev) => [...prev, ""]);
  }

  function removeText(i) {
    setTexts((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
    setError("");
  }

  async function runDrift() {
    setError("");
    setResult(null);

    if (cleaned.length < 2) {
      setError("Add at least 2 non-empty texts to compute drift.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analyze/text/drift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: cleaned }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`API ${res.status}: ${msg || "Request failed"}`);
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Drift analysis failed.");
      }

      setResult(data);
    } catch (e) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const driftScore = result?.driftScore ?? null;
  const driftBar = driftScore == null ? 0 : clamp(driftScore, 0, 100);

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
          <p className="text-sm leading-relaxed text-white/70">
            Drift mode (Transformer embeddings): paste multiple posts/snippets and measure how semantically consistent
            they are. High drift means the set is more scattered around its centroid.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: Inputs */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white/70">Texts to compare</div>
              <button
                onClick={addText}
                className="inline-flex h-8 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                + Add
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              {texts.map((t, i) => {
                const showRemove = texts.length > 2;
                const isOutlier = outlierSet.has(i);
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border p-3 ${
                      isOutlier
                        ? "border-red-500/40 bg-red-500/10"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-white/70">
                        Text {i + 1} {isOutlier ? <span className="text-red-200">(outlier)</span> : null}
                      </div>
                      {showRemove ? (
                        <button
                          onClick={() => removeText(i)}
                          className="text-xs text-white/55 hover:text-white"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <textarea
                      className="h-28 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                      value={t}
                      onChange={(e) => updateText(i, e.target.value)}
                      placeholder="Paste a post, bio snippet, or pitch paragraph…"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">
                Uses API: {API_BASE} (requires FastAPI running on :8000)
              </div>
              <button
                onClick={runDrift}
                disabled={loading}
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

          {/* Right: Results */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white/70">Drift result</div>
              <div className="text-xs text-white/55">
                {result?.embeddingModel ? `Model: ${result.embeddingModel}` : "—"}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs text-white/60">Drift score</div>
                  <div className="mt-1 text-3xl font-semibold text-white">
                    {driftScore == null ? "—" : driftScore}
                  </div>
                </div>
                <div className="text-xs text-white/55">
                  {result?.count ? `${result.count} texts` : ""}
                </div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-white/60" style={{ width: `${driftBar}%` }} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill label="Mean sim" value={result?.meanSimilarity ?? "—"} />
                <Pill label="Min sim" value={result?.minSimilarity ?? "—"} />
                <Pill label="Max sim" value={result?.maxSimilarity ?? "—"} />
                <Pill label="Std sim" value={result?.stdSimilarity ?? "—"} />
                <Pill label="Dim" value={result?.embeddingDim ?? "—"} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-white/70">Similarity to centroid (per text)</div>

              <div className="mt-2 flex flex-col gap-2">
                {(result?.similarityToCentroid || []).map((s, i) => {
                  const isOutlier = outlierSet.has(i);
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                        isOutlier
                          ? "border-red-500/40 bg-red-500/10 text-red-100"
                          : "border-white/10 bg-black/30 text-white/70"
                      }`}
                    >
                      <div>Text {i + 1}</div>
                      <div className="font-semibold">{s}</div>
                    </div>
                  );
                })}

                {!result ? (
                  <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/55">
                    Click “Compute Drift” to see results.
                  </div>
                ) : null}
              </div>
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
