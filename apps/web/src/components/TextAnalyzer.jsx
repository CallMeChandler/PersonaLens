"use client";

import React, { useMemo, useState } from "react";
import { saveLastRun } from "@/lib/reportVault";


const BUZZWORDS = [
  "synergy", "leverage", "scalable", "disrupt", "disruption", "ai", "ml", "deep learning", "blockchain",
  "growth hacking", "10x", "impact", "visionary", "thought leader", "innovative", "cutting-edge",
  "end-to-end", "stakeholder", "alignment", "strategic", "value-add", "paradigm", "robust", "seamless",
  "world-class", "best-in-class", "genai", "llm", "agentic", "transformative"
];

const HEDGES = ["maybe", "probably", "possibly", "somewhat", "kind of", "sort of", "i think", "i guess", "perhaps"];
const ABSOLUTES = ["always", "never", "guaranteed", "everyone", "no one", "undeniable", "proven", "certainly", "definitely"];

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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

// Local preview (client-side baseline)
function analyzeTextLocal(text) {
  const words = wordList(text);
  const wordCount = words.length;

  const sentenceCount = Math.max(
    1,
    (text || "").split(/[.!?]+/).map(s => s.trim()).filter(Boolean).length
  );

  const buzzwordHits = countPhrases(text, BUZZWORDS);
  const hedgeHits = countPhrases(text, HEDGES);
  const absoluteHits = countPhrases(text, ABSOLUTES);

  const metricHits = ((text || "").match(/(\b\d+(\.\d+)?\b)|(%|\$|₹)|(\bq[1-4]\b)|(\b20\d{2}\b)/gi) || []).length;

  const buzzwordPer100Words = wordCount ? (buzzwordHits / wordCount) * 100 : 0;

  let score = 60;
  score += Math.min(20, metricHits * 2);
  score -= Math.min(30, buzzwordPer100Words * 2);
  score -= Math.min(15, absoluteHits * 2);
  score -= Math.min(10, hedgeHits * 1);
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    wordCount,
    sentenceCount,
    metricHits,
    buzzwordHits,
    hedgeHits,
    absoluteHits,
    buzzwordPer100Words: Math.round(buzzwordPer100Words * 10) / 10,
  };
}

function Pill({ label, value }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
      <span className="text-white/60">{label}: </span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export default function TextAnalyzer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null); // server result (frozen)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => analyzeTextLocal(text), [text]);
  const canAnalyze = text.trim().length >= 40;

  async function runAnalyze() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`API ${res.status}: ${msg || "Request failed"}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e?.message || "Unknown error");
      setResult(null);
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
            Text-mode prototype: surfaces credibility-related signals (specificity, buzzword density, hedging, absolutes).
            This does not claim factual truth—only linguistic patterns.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="mb-2 block text-xs font-medium text-white/70">
              Paste bio / posts / pitch text
            </label>

            <textarea
              className="h-56 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/20"
              placeholder="Example: I built an end-to-end scalable GenAI agentic platform that disrupted the market..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-white/55">
                Tip: 2–3 paragraphs works best (min 40 chars to run).
              </div>

              <button
                onClick={() => {
                  const out = analyzeText(text);
                  setResult(out);

                  saveLastRun("single", {
                    meta: { generatedAt: new Date().toISOString() },
                    input: { text },
                    output: out,
                  });
                }}

                disabled={!canAnalyze || loading}
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {error ? (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-3 text-[11px] text-white/45">
              API: {API_BASE}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-white/70">Live preview (local)</div>
              <div className="text-xs text-white/55">Score is a signal, not a verdict</div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-xs text-white/60">Credibility signal score</div>
                  <div className="mt-1 text-3xl font-semibold text-white">{preview.score}</div>
                </div>
                <div className="text-xs text-white/55">{preview.wordCount} words</div>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-white/60"
                  style={{ width: `${preview.score}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Pill label="Metrics" value={preview.metricHits} />
                <Pill label="Buzzwords" value={`${preview.buzzwordHits} (${preview.buzzwordPer100Words}/100w)`} />
                <Pill label="Hedges" value={preview.hedgeHits} />
                <Pill label="Absolutes" value={preview.absoluteHits} />
                <Pill label="Sentences" value={preview.sentenceCount} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-white/70">Last run (server, frozen)</div>
              <pre className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                {JSON.stringify(result ?? { note: "Click Analyze to call the API and freeze a run." }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
