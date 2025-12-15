"use client";

import React, { useMemo, useState } from "react";
import TextAnalyzer from "@/components/TextAnalyzer";
import DriftAnalyzer from "@/components/DriftAnalyzer";
import TimelineAnalyzer from "@/components/TimelineAnalyzer";
import ClustersAnalyzer from "@/components/ClustersAnalyzer";

import { downloadJSON } from "@/lib/reportUtils";
import { loadAllLastRuns, countAvailableRuns } from "@/lib/reportVault";

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
        active
          ? "border border-white/25 bg-white/15 text-white"
          : "border border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function PersonaLensDashboard() {
  const [tab, setTab] = useState("single");

  const allRuns = useMemo(() => {
    if (typeof window === "undefined") return null;
    return loadAllLastRuns();
  }, [tab]); // refresh snapshot when switching tabs

  const availableCount = useMemo(() => countAvailableRuns(allRuns), [allRuns]);

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
        "Sections are populated after you run each analyzer at least once (Single/Drift/Timeline/Clusters).",
    });
  }

  return (
    <main className="min-h-screen bg-[#070B14] px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="text-xs text-white/55">
          PersonaLens Dashboard{" "}
          <span className="text-white/35">•</span>{" "}
          <span className="text-white/55">Saved sections: {availableCount}/4</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            onClick={downloadFullReport}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Download Full Report
          </button>

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
        </div>
      </div>

      {tab === "single" ? <TextAnalyzer /> : null}
      {tab === "drift" ? <DriftAnalyzer /> : null}
      {tab === "timeline" ? <TimelineAnalyzer /> : null}
      {tab === "clusters" ? <ClustersAnalyzer /> : null}
    </main>
  );
}
