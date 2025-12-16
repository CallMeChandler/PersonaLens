"use client";

import React, { useMemo, useState } from "react";
import TextAnalyzer from "@/components/TextAnalyzer";
import DriftAnalyzer from "@/components/DriftAnalyzer";
import TimelineAnalyzer from "@/components/TimelineAnalyzer";
import ClustersAnalyzer from "@/components/ClustersAnalyzer";
import AudioShiftAnalyzer from "@/components/AudioShiftAnalyzer";
import VideoShiftAnalyzer from "./VideoShiftAnalyzer";

import { downloadJSON } from "@/lib/reportUtils";
import { loadAllLastRuns, countAvailableRuns } from "@/lib/reportVault";

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "whitespace-nowrap inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
        "border",
        active
          ? "border-white/25 bg-white/15 text-white shadow-[0_10px_30px_-18px_rgba(255,255,255,0.35)]"
          : "border-white/12 bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/80">
      <span className="text-white/55">{label}</span>
      <span className="font-semibold text-white/90">{value}</span>
    </div>
  );
}

export default function PersonaLensDashboard() {
  const [tab, setTab] = useState("single");

  const allRuns = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadAllLastRuns();
  }, [tab]); // refresh snapshot when switching tabs

  const availableCount = useMemo(() => countAvailableRuns(allRuns), [allRuns]);
  const totalSections = 6; // single, drift, timeline, clusters, audio, video

  function downloadFullReport() {
    const snapshot = loadAllLastRuns();

    downloadJSON("personalens-full-report", {
      meta: {
        generatedAt: new Date().toISOString(),
        app: "PersonaLens",
        version: "0.1.0",
      },
      sections: snapshot,
      note:
        "Sections are populated after you run each analyzer at least once. Outputs are signals/anomalies for exploration (not medical, not deception detection, not truth verification).",
    });
  }

  return (
    <main className="min-h-screen bg-[#070B14]">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-180px] top-[-160px] h-[520px] w-[520px] rounded-full bg-white/10 blur-[120px]" />
        <div className="absolute right-[-200px] top-[120px] h-[520px] w-[520px] rounded-full bg-white/10 blur-[140px]" />
        <div className="absolute bottom-[-220px] left-[20%] h-[520px] w-[520px] rounded-full bg-white/10 blur-[140px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* Header / Brand */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              {/* simple logo mark */}
              {/* simple logo mark */}
              <div className="mt-0.5 h-10 w-10 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] shadow-[0_16px_40px_-30px_rgba(255,255,255,0.35)]">
                <img
                  src="/personaLensLogo.png"
                  alt="PersonaLens logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-white">
                  PersonaLens
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Multimodal delivery-consistency & baseline-relative shift explorer
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatPill label="Saved sections" value={`${availableCount}/${totalSections}`} />
                  <StatPill label="Mode" value="Explainable signals" />
                  <StatPill label="Boundary" value="Not deception detection" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={downloadFullReport}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold transition",
                  "border border-white/20 bg-white/10 text-white hover:bg-white/15",
                  "shadow-[0_18px_50px_-35px_rgba(255,255,255,0.35)]",
                ].join(" ")}
              >
                Download Full Report
              </button>

              <div className="text-xs text-white/50">
                Outputs are “signals” and “anomalies” only.
              </div>
            </div>
          </div>

          {/* Tabs row (single line, scrollable) */}
          <div
            className={[
              "mt-5 flex items-center gap-2",
              "flex-nowrap overflow-x-auto overflow-y-hidden",
              "pb-2",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            ].join(" ")}
          >
            <TabButton active={tab === "single"} onClick={() => setTab("single")}>
              Single Text
            </TabButton>
            <TabButton active={tab === "drift"} onClick={() => setTab("drift")}>
              Drift
            </TabButton>
            <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
              Timeline
            </TabButton>
            <TabButton active={tab === "clusters"} onClick={() => setTab("clusters")}>
              Clusters
            </TabButton>
            <TabButton active={tab === "audio"} onClick={() => setTab("audio")}>
              Delivery Shift (Audio)
            </TabButton>
            <TabButton active={tab === "video"} onClick={() => setTab("video")}>
              Visual Shift (Video)
            </TabButton>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-60px_rgba(0,0,0,0.9)]">
          {tab === "single" ? <TextAnalyzer /> : null}
          {tab === "drift" ? <DriftAnalyzer /> : null}
          {tab === "timeline" ? <TimelineAnalyzer /> : null}
          {tab === "clusters" ? <ClustersAnalyzer /> : null}
          {tab === "audio" ? <AudioShiftAnalyzer /> : null}
          {tab === "video" ? <VideoShiftAnalyzer /> : null}
        </div>

        {/* Footer note */}
        <div className="mt-5 text-center text-xs text-white/45">
          PersonaLens surfaces baseline-relative patterns for exploration. It does not verify truth and is not medical advice.
        </div>
      </div>
    </main>
  );
}
