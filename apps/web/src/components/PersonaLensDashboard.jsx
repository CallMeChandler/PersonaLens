"use client";

import React, { useState } from "react";
import TextAnalyzer from "@/components/TextAnalyzer";
import DriftAnalyzer from "@/components/DriftAnalyzer";
import TimelineAnalyzer from "@/components/TimelineAnalyzer";

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

  return (
    <main className="min-h-screen bg-[#070B14] px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-5xl items-center justify-between">
        <div className="text-xs text-white/55">PersonaLens Dashboard</div>

        <div className="flex gap-2">
          <TabButton active={tab === "single"} onClick={() => setTab("single")}>
            Single Text
          </TabButton>
          <TabButton active={tab === "drift"} onClick={() => setTab("drift")}>
            Drift
          </TabButton>
          <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
            Timeline
          </TabButton>
        </div>
      </div>

      {tab === "single" ? <TextAnalyzer /> : null}
      {tab === "drift" ? <DriftAnalyzer /> : null}
      {tab === "timeline" ? <TimelineAnalyzer /> : null}
    </main>
  );
}
