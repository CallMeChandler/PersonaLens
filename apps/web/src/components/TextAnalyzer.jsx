"use client";

import React, { useMemo, useState } from "react";
import { saveLastRun } from "@/lib/reportVault";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  BarChart3,
  Zap,
  Target,
  TrendingUp,
  Shield,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Cpu,
  Brain,
  Search,
  Filter
} from "lucide-react";

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

function MetricCard({ label, value, icon: Icon, trend = "neutral", description }) {
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
              <div className={`p-2 rounded-lg ${trend === "positive" ? "bg-emerald-500/20" : trend === "negative" ? "bg-rose-500/20" : "bg-blue-500/20"}`}>
                <Icon size={16} className={`${trend === "positive" ? "text-emerald-400" : trend === "negative" ? "text-rose-400" : "text-blue-400"}`} />
              </div>
            )}
            <span className="text-xs font-medium text-white/70">{label}</span>
          </div>
          <div className="text-2xl font-bold text-white">{value}</div>
          {description && (
            <div className="mt-2 text-xs text-white/60">{description}</div>
          )}
        </div>
        {/* {trend !== "neutral" && (
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            trend === "positive" 
              ? "bg-emerald-500/20 text-emerald-300"
              : trend === "negative"
              ? "bg-rose-500/20 text-rose-300"
              : "bg-amber-500/20 text-amber-300"
          }`}>
            {trend === "positive" ? "Optimal" : trend === "negative" ? "Monitor" : "Neutral"}
          </div>
        )} */}
      </div>
    </div>
  );
}

function ScoreIndicator({ score }) {
  const getScoreColor = (score) => {
    if (score >= 80) return "from-emerald-500 to-emerald-600";
    if (score >= 60) return "from-blue-500 to-cyan-500";
    if (score >= 40) return "from-amber-500 to-amber-600";
    return "from-rose-500 to-rose-600";
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "High Credibility Signals";
    if (score >= 60) return "Moderate Credibility";
    if (score >= 40) return "Needs Review";
    return "Anomalies Detected";
  };

  return (
    <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Target size={20} className="text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Credibility Signal Score</h3>
          </div>
          <p className="text-sm text-white/60 mt-1">{getScoreLabel(score)}</p>
        </div>
        <div className={`text-4xl font-bold bg-gradient-to-r ${getScoreColor(score)} bg-clip-text text-transparent`}>
          {score}
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between text-xs text-white/60 mb-2">
          <span>Low Signals</span>
          <span>High Signals</span>
        </div>
        <div className="h-3 w-full rounded-full bg-white/[0.08] overflow-hidden">
          <div 
            className={`h-full rounded-full bg-gradient-to-r ${getScoreColor(score)} transition-all duration-1000`}
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
    </div>
  );
}

function AnalysisBadge({ type, count, label }) {
  const config = {
    buzzwords: { 
      color: "from-purple-500/20 to-pink-500/20", 
      border: "border-purple-500/30",
      icon: Zap
    },
    metrics: { 
      color: "from-emerald-500/20 to-teal-500/20", 
      border: "border-emerald-500/30",
      icon: TrendingUp
    },
    hedges: { 
      color: "from-amber-500/20 to-orange-500/20", 
      border: "border-amber-500/30",
      icon: AlertTriangle
    },
    absolutes: { 
      color: "from-rose-500/20 to-red-500/20", 
      border: "border-rose-500/30",
      icon: Shield
    }
  };

  const { color, border, icon: Icon } = config[type] || config.buzzwords;

  return (
    <div className={`group relative overflow-hidden rounded-xl border ${border} bg-gradient-to-br ${color} p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color.replace("/20", "/30")}`}>
            <Icon size={18} className={`${type === "buzzwords" ? "text-purple-400" : type === "metrics" ? "text-emerald-400" : type === "hedges" ? "text-amber-400" : "text-rose-400"}`} />
          </div>
          <div>
            <div className="text-xs text-white/70">{label}</div>
            <div className="text-2xl font-bold text-white mt-1">{count}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-white/40 group-hover:text-white/60 transition-colors" />
      </div>
    </div>
  );
}

export default function TextAnalyzer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
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
      
      saveLastRun("single", {
        meta: { generatedAt: new Date().toISOString() },
        input: { text },
        output: data,
      });
    } catch (e) {
      setError(e?.message || "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <FileText size={24} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Text Analysis</h1>
                <p className="text-white/70 mt-1">Deep linguistic pattern detection for credibility signals</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Cpu size={16} />
                <span>Local Preview: Active</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Brain size={16} />
                <span>Server Analysis: {result ? "Completed" : "Pending"}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              setText("");
              setResult(null);
              setError("");
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
          <div className="relative rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Text Input</h3>
                <p className="text-sm text-white/60">Paste bio, posts, or pitch text for analysis</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <Search size={12} />
                <span>{text.length} characters</span>
              </div>
            </div>

            <div className="relative">
              <textarea
                className="w-full h-64 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-300 resize-none"
                placeholder="Example: Our AI-powered platform leverages cutting-edge machine learning to disrupt traditional workflows through scalable, end-to-end solutions that guarantee 10x productivity improvements..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-xs ${canAnalyze ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                  {canAnalyze ? "Ready to analyze" : `${40 - text.length} chars needed`}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-white/50 flex-1">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>Analysis requires minimum 40 characters for accurate signal detection</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={runAnalyze}
                  disabled={!canAnalyze || loading}
                  className={`
                    relative overflow-hidden rounded-xl px-6 py-3
                    flex items-center justify-center gap-2
                    ${canAnalyze 
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-[0_0_40px_-12px_rgba(0,198,255,0.8)]" 
                      : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                    }
                    font-semibold text-sm transition-all duration-300
                  `}
                >
                  {loading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-white/20 to-cyan-500/0 translate-x-[-200%] animate-shimmer" />
                  )}
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Activity size={18} />
                      <span>Analyze Text</span>
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

          {/* Real-time Insights */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-cyan-400" />
                Real-time Preview (Local Analysis)
              </h3>
              <div className="text-xs text-white/50 flex items-center gap-2">
                <Filter size={12} />
                Updates as you type
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard 
                label="Word Count" 
                value={preview.wordCount}
                icon={FileText}
                trend={preview.wordCount > 200 ? "positive" : preview.wordCount < 80 ? "negative" : "neutral"}
                description={preview.wordCount > 200 ? "Comprehensive" : preview.wordCount < 80 ? "Limited context" : "Balanced"}
              />
              <MetricCard 
                label="Sentences" 
                value={preview.sentenceCount}
                icon={Target}
                trend={preview.sentenceCount > 10 ? "positive" : preview.sentenceCount < 3 ? "negative" : "neutral"}
                description="Structural complexity"
              />
              <MetricCard 
                label="Metrics Found" 
                value={preview.metricHits}
                icon={TrendingUp}
                trend={preview.metricHits > 3 ? "positive" : "neutral"}
                description="Quantitative specificity"
              />
              <MetricCard 
                label="Buzzword Ratio" 
                value={`${preview.buzzwordPer100Words}/100w`}
                icon={Zap}
                trend={preview.buzzwordPer100Words > 10 ? "negative" : "positive"}
                description={preview.buzzwordPer100Words > 10 ? "High jargon density" : "Clear language"}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          <ScoreIndicator score={preview.score} />

          {/* Pattern Analysis */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity size={20} className="text-cyan-400" />
              Pattern Analysis
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <AnalysisBadge 
                type="buzzwords"
                count={preview.buzzwordHits}
                label="Buzzwords"
              />
              <AnalysisBadge 
                type="hedges"
                count={preview.hedgeHits}
                label="Hedges"
              />
              <AnalysisBadge 
                type="absolutes"
                count={preview.absoluteHits}
                label="Absolutes"
              />
              <AnalysisBadge 
                type="metrics"
                count={preview.metricHits}
                label="Metrics"
              />
            </div>

            <div className="mt-6 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <Shield size={12} />
                <span>These are linguistic signals, not truth verification</span>
              </div>
            </div>
          </div>

          {/* Server Results */}
          <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {result ? (
                  <>
                    <CheckCircle size={20} className="text-emerald-400" />
                    <span>Server Analysis Complete</span>
                  </>
                ) : (
                  <>
                    <Brain size={20} className="text-amber-400" />
                    <span>Server Analysis</span>
                  </>
                )}
              </h3>
              {result && (
                <div className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                  Saved to vault
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-xl border border-white/[0.05] bg-black/20" />
              <pre className="relative max-h-64 overflow-auto rounded-xl p-4 text-xs text-white/70 bg-black/30 backdrop-blur-sm">
                {result 
                  ? JSON.stringify(result, null, 2)
                  : "Complete analysis will appear here after running server analysis. This includes enhanced NLP insights and cross-referenced patterns."
                }
              </pre>
            </div>

            {result && (
              <button
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'});
                  element.href = URL.createObjectURL(file);
                  element.download = `text-analysis-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(element);
                  element.click();
                  document.body.removeChild(element);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-300"
              >
                <Download size={16} />
                Export JSON Results
              </button>
            )}
          </div>

          {/* API Status */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="text-xs text-white/50">
              <div className="font-medium text-white/70 mb-1">API Endpoint</div>
              <code className="block truncate rounded bg-black/30 px-3 py-2 font-mono">
                {API_BASE}/analyze/text
              </code>
              <div className="flex items-center gap-2 mt-3">
                <div className={`w-2 h-2 rounded-full ${result ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span>{result ? "Server connection active" : "Ready for analysis"}</span>
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
            <span>PersonaLens surfaces linguistic patterns and credibility signals for exploratory analysis. It does not verify factual truth, detect deception, or provide medical/diagnostic assessments.</span>
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