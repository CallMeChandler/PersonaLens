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

/** -------- Local heuristic signals (same spirit as Single Text) -------- */
const BUZZWORDS = [
  "synergy","leverage","scalable","disrupt","disruption","ai","ml","deep learning","blockchain",
  "growth hacking","10x","impact","visionary","thought leader","innovative","cutting-edge",
  "end-to-end","stakeholder","alignment","strategic","value-add","paradigm","robust","seamless",
  "world-class","best-in-class","genai","llm","agentic","transformative"
];
const HEDGES = ["maybe","probably","possibly","somewhat","kind of","sort of","i think","i guess","perhaps"];
const ABSOLUTES = ["always","never","guaranteed","everyone","no one","undeniable","proven","certainly","definitely"];

function normalize(text) {
  return (text || "").toLowerCase();
}
function countPhrases(text, phrases) {
  const t = normalize(text);
  let total = 0;
  for (const p of phrases) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const m = t.match(re);
    total += m ? m.length : 0;
  }
  return total;
}
function wordList(text) {
  const t = normalize(text);
  const m = t.match(/[a-z0-9]+(?:[-+][a-z0-9]+)*/g);
  return m || [];
}
function analyzeLocalSignals(text) {
  const words = wordList(text);
  const wordCount = words.length;

  const sentenceCount = Math.max(
    1,
    (text || "").split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length
  );

  const buzzwordHits = countPhrases(text, BUZZWORDS);
  const hedgeHits = countPhrases(text, HEDGES);
  const absoluteHits = countPhrases(text, ABSOLUTES);

  const metricHits =
    ((text || "").match(/(\b\d+(\.\d+)?\b)|(%|\$|₹)|(\bq[1-4]\b)|(\b20\d{2}\b)/gi) || []).length;

  const buzzwordPer100Words = wordCount ? (buzzwordHits / wordCount) * 100 : 0;

  return {
    wordCount,
    sentenceCount,
    metricHits,
    buzzwordHits,
    hedgeHits,
    absoluteHits,
    buzzwordPer100Words: Math.round(buzzwordPer100Words * 10) / 10,
  };
}

function reasonTags(sig) {
  if (!sig) return [];
  const tags = [];

  if (sig.wordCount < 20) tags.push("Very short text (noisy)");
  if (sig.metricHits === 0) tags.push("Low specificity (few/no metrics)");
  if (sig.metricHits >= 3) tags.push("Has measurable specifics");

  if (sig.buzzwordPer100Words >= 2.0) tags.push("High buzzword density");
  else if (sig.buzzwordHits >= 3) tags.push("Buzzword-heavy");

  if (sig.absoluteHits >= 2) tags.push("Overconfident language");
  if (sig.hedgeHits >= 2) tags.push("Hedging/uncertainty language");

  // A concise combined flag that reads well:
  if (sig.metricHits === 0 && (sig.buzzwordPer100Words >= 2.0 || sig.buzzwordHits >= 3)) {
    tags.push("Generic phrasing vs low evidence");
  }

  return tags.slice(0, 4);
}

/** -------- Mini chart -------- */
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[520px] rounded-2xl border border-white/10 bg-black/30">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="rgba(255,255,255,0.10)" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="rgba(255,255,255,0.10)" />

        <polyline fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2" points={polyline} />

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

/** -------- Bulk importer --------
Accepted per-line formats:
  YYYY-MM-DD - text
  YYYY-MM-DD | text
  YYYY-MM-DD: text
  YYYY-MM-DD — text   (em dash)
*/
function parseDumpToItems(dump) {
  const lines = (dump || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];

  for (const line of lines) {
    // Date at start
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*([\-|:–—])\s*(.+)$/);
    if (m) {
      out.push({ date: m[1], text: m[3].trim() });
      continue;
    }
    // If user pasted "YYYY-MM-DD    text" (multiple spaces or tab)
    const m2 = line.match(/^(\d{4}-\d{2}-\d{2})\s{2,}(.+)$/);
    if (m2) {
      out.push({ date: m2[1], text: m2[2].trim() });
      continue;
    }
    // If no parse, skip silently (keeps importer forgiving)
  }

  return out;
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

  // Map from payload index -> UI items index (prevents index mismatch when blank rows exist)
  const [indexMap, setIndexMap] = useState([]); // array of uiIndex by payloadIndex

  function updateItem(i, patch) {
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
    setResult(null);
    setError("");
  }

  function addRow() {
    setItems((prev) => [...prev, { date: "", text: "" }]);
    setResult(null);
    setError("");
  }

  function removeRow(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
    setError("");
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

  const payloadItems = useMemo(() => payloadWithMap.map(({ date, text }) => ({ date, text })), [payloadWithMap]);
  const nextIndexMap = useMemo(() => payloadWithMap.map((x) => x.uiIndex), [payloadWithMap]);

  const outlierUISet = useMemo(() => {
    const s = new Set();
    const windows = result?.windows || [];
    for (const w of windows) {
      (w.outlierIndices || []).forEach((payloadIdx) => {
        const uiIdx = indexMap[payloadIdx];
        if (typeof uiIdx === "number") s.add(uiIdx);
      });
    }
    return s;
  }, [result, indexMap]);

  const windowDrifts = useMemo(() => (result?.windows || []).map((w) => w.driftScore), [result]);
  const windowLabels = useMemo(() => (result?.windows || []).map((w) => w.endDate), [result]);
  const windowHighlights = useMemo(
    () => (result?.windows || []).map((w) => (w.outlierIndices || []).length > 0),
    [result]
  );

  const outlierReasonCards = useMemo(() => {
    if (!result) return [];
    // Collect unique outlier payload indices across all windows
    const payloadOutliers = new Set();
    for (const w of result.windows || []) {
      for (const idx of w.outlierIndices || []) payloadOutliers.add(idx);
    }

    const cards = [];
    for (const payloadIdx of payloadOutliers) {
      const uiIdx = indexMap[payloadIdx];
      if (typeof uiIdx !== "number") continue;
      const it = items[uiIdx];
      const sig = analyzeLocalSignals(it?.text || "");
      cards.push({
        uiIdx,
        payloadIdx,
        date: it?.date || result.dates?.[payloadIdx] || "—",
        text: (it?.text || "").trim(),
        sig,
        tags: reasonTags(sig),
      });
    }
    // sort by UI order
    cards.sort((a, b) => a.uiIdx - b.uiIdx);
    return cards;
  }, [result, indexMap, items]);

  function importBulk() {
    setBulkInfo("");
    setError("");
    setResult(null);

    const parsed = parseDumpToItems(bulkDump);
    if (!parsed.length) {
      setBulkInfo("No valid lines found. Use: YYYY-MM-DD - your text (or | / : / —).");
      return;
    }

    setItems(parsed);
    setBulkInfo(`Imported ${parsed.length} items.`);
  }

  async function runTimeline() {
    setError("");
    setResult(null);

    if (payloadItems.length < 2) {
      setError("Add at least 2 valid rows (date + text) to compute timeline drift.");
      return;
    }

    setLoading(true);
    try {
      // Persist the mapping that matches THIS request
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
    } catch (e) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.03] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">PersonaLens</h1>
          <p className="text-sm leading-relaxed text-white/70">
            Timeline mode: enter dated posts/snippets. We compute transformer-based drift between adjacent posts and rolling-window drift to surface narrative instability and outliers.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: inputs */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            {/* Bulk importer */}
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
                    className={`rounded-2xl border p-3 ${
                      isOutlier ? "border-red-500/40 bg-red-500/10" : "border-white/10 bg-black/30"
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
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white/70">Timeline result</div>
              <div className="text-xs text-white/55">
                {result?.embeddingModel ? `Model: ${result.embeddingModel}` : "—"}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap gap-2">
                <Pill label="Items" value={result?.count ?? "—"} />
                <Pill label="Window" value={result?.window ?? "—"} />
                <Pill label="Stride" value={result?.stride ?? "—"} />
                <Pill label="Outlier posts" value={outlierReasonCards.length} />
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

            {/* Outlier Reasons */}
            <div className="mt-4">
              <div className="text-xs font-medium text-white/70">Outlier reasons (quick signals)</div>
              <div className="mt-2 flex flex-col gap-2">
                {outlierReasonCards.length ? (
                  outlierReasonCards.map((c) => (
                    <div
                      key={c.uiIdx}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-red-100">
                          Item {c.uiIdx + 1} • {c.date}
                        </div>
                        <div className="text-[11px] text-red-100/70">
                          words {c.sig.wordCount} • metrics {c.sig.metricHits} • buzz {c.sig.buzzwordHits}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-red-50/90 line-clamp-3">
                        {c.text || "—"}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-red-200/20 bg-black/20 px-3 py-1 text-[11px] text-red-50/90"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
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
{JSON.stringify(result ?? { note: "No result yet." }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
