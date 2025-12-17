"use client";

import React, { useMemo, useState, useEffect } from "react";
import TextAnalyzer from "@/components/TextAnalyzer";
import DriftAnalyzer from "@/components/DriftAnalyzer";
import TimelineAnalyzer from "@/components/TimelineAnalyzer";
import ClustersAnalyzer from "@/components/ClustersAnalyzer";
import AudioShiftAnalyzer from "@/components/AudioShiftAnalyzer";
import VideoShiftAnalyzer from "./VideoShiftAnalyzer";

import { downloadJSON } from "@/lib/reportUtils";
import { loadAllLastRuns, countAvailableRuns } from "@/lib/reportVault";

import {
  BarChart3,
  Download,
  Zap,
  Shield,
  Activity,
  Cpu,
  Waves,
  Eye,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database
} from "lucide-react";

function TabButton({ active, children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={[
        "group relative flex-1 min-w-[140px] h-14 px-6 rounded-xl transition-all duration-300",
        "flex items-center justify-center gap-3",
        "border border-white/[0.08] backdrop-blur-sm",
        active
          ? "bg-gradient-to-br from-white/15 via-white/10 to-transparent shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_8px_32px_-16px_rgba(0,198,255,0.4)]"
          : "bg-white/[0.04] hover:bg-white/[0.08] hover:shadow-[0_8px_32px_-12px_rgba(0,198,255,0.2)]",
      ].join(" ")}
    >
      <div className="relative flex items-center gap-3">
        {Icon && (
          <div className={[
            "p-2 rounded-lg transition-all duration-300",
            active
              ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400"
              : "bg-white/[0.06] text-white/60 group-hover:text-cyan-300"
          ].join(" ")}>
            <Icon size={18} />
          </div>
        )}
        <span className={[
          "font-semibold text-sm whitespace-nowrap",
          active ? "text-white" : "text-white/80 group-hover:text-white"
        ].join(" ")}>
          {children}
        </span>
      </div>
      {active && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
      )}
    </button>
  );
}

function StatPill({ label, value, icon: Icon, status = "neutral" }) {
  const statusColors = {
    neutral: "from-white/5 to-white/10",
    success: "from-emerald-500/10 to-emerald-600/10",
    warning: "from-amber-500/10 to-amber-600/10",
    info: "from-cyan-500/10 to-cyan-600/10"
  };

  return (
    <div className={[
      "group relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-[1.02]",
      "bg-gradient-to-br border border-white/[0.08] backdrop-blur-sm",
      statusColors[status]
    ].join(" ")}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-white/[0.08]">
              <Icon size={18} className="text-white/70" />
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-white/60">{label}</div>
            <div className="text-lg font-bold text-white mt-1">{value}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-white/40 group-hover:text-white/60 transition-colors" />
      </div>
    </div>
  );
}

function DashboardCard({ title, description, icon: Icon, gradient = "from-blue-500/20 to-purple-500/20" }) {
  return (
    <div className="relative group overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_60px_-15px_rgba(0,198,255,0.3)]">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 from-blue-500/5 via-transparent to-purple-500/5" />
      <div className="relative">
        <div className={[
          "inline-flex p-3 rounded-xl mb-4",
          "bg-gradient-to-br", gradient
        ].join(" ")}>
          {Icon && <Icon size={24} className="text-white" />}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export default function PersonaLensDashboard() {
  const [tab, setTab] = useState("single");
  const [isLoading, setIsLoading] = useState(false);
  const [activeGlow, setActiveGlow] = useState({ x: 0, y: 0 });
  const [availableCount, setAvailableCount] = useState(0);

  useEffect(() => {
    const allRuns = loadAllLastRuns();
    setAvailableCount(countAvailableRuns(allRuns));
  }, [tab]);

  const totalSections = 6;

  const handleMouseMove = (e) => {
    setActiveGlow({ x: e.clientX, y: e.clientY });
  };

  function downloadFullReport() {
    setIsLoading(true);
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

    setTimeout(() => setIsLoading(false), 1000);
  }

  const tabs = [
    { id: "single", label: "Single Text", icon: BarChart3 },
    { id: "drift", label: "Drift Analysis", icon: Activity },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "clusters", label: "Clusters", icon: Database },
    { id: "audio", label: "Audio Shift", icon: Waves },
    { id: "video", label: "Visual Shift", icon: Eye },
  ];

  const stats = [
    { label: "Analysis Complete", value: `${availableCount}/${totalSections}`, icon: CheckCircle2, status: availableCount === totalSections ? "success" : availableCount > 0 ? "warning" : "neutral" },
    { label: "Processing Mode", value: "Neural Insights", icon: Cpu, status: "info" },
    { label: "Signal Confidence", value: "High Precision", icon: Shield, status: "success" },
    { label: "Last Updated", value: "Just now", icon: Zap, status: "neutral" },
  ];

  return (
    <main
      className="min-h-screen bg-[#0A0F1F] text-white overflow-x-hidden w-full relative"
      onMouseMove={handleMouseMove}
    >
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0F1F] via-[#0F1525] to-[#0A0F1F]" />

        {/* Animated gradient orbs */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-30 transition-all duration-700"
          style={{
            left: `${activeGlow.x - 400}px`,
            top: `${activeGlow.y - 400}px`,
            background: 'radial-gradient(circle, rgba(0,198,255,0.3) 0%, rgba(138,43,226,0.2) 50%, transparent 70%)',
          }}
        />

        {/* Static grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px),
                           linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-purple-500/10 to-transparent blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl w-full">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 md:p-8 backdrop-blur-xl shadow-2xl">
            {/* Header glow effect */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

            <div className="relative">
              {/* Changed lg:flex-row to flex-wrap to prevent overflow on intermediate screens */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Logo with glow */}
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-30" />
                    <div className="relative p-3 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/[0.1]">
                      <img
                        src="/personaLensLogo.png"
                        alt="PersonaLens logo"
                        className="h-12 w-12 md:h-20 md:w-20 object-contain"
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white via-cyan-100 to-white bg-clip-text text-transparent truncate">
                        PersonaLens
                      </h1>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                        v1.0
                      </span>
                    </div>
                    <p className="text-white/70 text-sm md:text-lg max-w-2xl break-words">
                      Advanced multimodal consistency analysis for detecting baseline-relative behavioral shifts
                    </p>
                  </div>
                </div>

                {/* CTA Section */}
                <div className="flex flex-col gap-4 w-full lg:w-auto">
                  <button
                    onClick={downloadFullReport}
                    disabled={isLoading}
                    className={[
                      "group relative overflow-hidden rounded-xl px-6 py-3",
                      "flex items-center justify-center gap-2",
                      "bg-gradient-to-r from-cyan-600 to-blue-600",
                      "text-white font-semibold text-sm",
                      "transition-all duration-300 hover:shadow-[0_0_40px_-12px_rgba(0,198,255,0.8)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "w-full lg:w-auto" // Full width on mobile
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-white/20 to-cyan-500/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span className="whitespace-nowrap">Export Full Report</span>
                        <Sparkles size={16} className="ml-1 opacity-60" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 text-xs text-white/50 justify-center lg:justify-end">
                    <AlertCircle size={12} className="flex-shrink-0" />
                    <span className="truncate">Outputs are exploratory signals only</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                  <StatPill key={index} {...stat} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Analysis Modules */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="sticky top-8">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Database size={14} />
                  Analysis Modules
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {tabs.map((tabItem) => (
                    <button
                      key={tabItem.id}
                      onClick={() => setTab(tabItem.id)}
                      className={[
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                        tab === tabItem.id
                          ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30"
                          : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                      ].join(" ")}
                    >
                      <tabItem.icon size={18} className="flex-shrink-0" />
                      <span className="truncate">{tabItem.label}</span>
                      {tab === tabItem.id && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-cyan-500 animate-pulse hidden lg:block" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Insights */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 hidden lg:block">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap size={14} />
                  Quick Insights
                </h4>
                <div className="space-y-3">
                  <div className="text-xs text-white/60">
                    <div className="font-medium text-white/80 mb-1">Signal Strength</div>
                    <div className="w-full bg-white/[0.08] rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${(availableCount / totalSections) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs">
                    <div className="text-white/60">Active Analyses</div>
                    <div className="font-semibold text-white mt-1">{availableCount} of {totalSections}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Panel - Added min-w-0 to fix overflow */}
          <div className="flex-1 min-w-0">
            {/* Enhanced Tab Navigation */}
            <div className="mb-6 lg:hidden">
              <div className="flex overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                <div className="flex gap-3 min-w-max">
                  {tabs.map((tabItem) => (
                    <TabButton
                      key={tabItem.id}
                      active={tab === tabItem.id}
                      onClick={() => setTab(tabItem.id)}
                      icon={tabItem.icon}
                    >
                      {tabItem.label}
                    </TabButton>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl border border-white/[0.1] bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl shadow-2xl" />
              <div className="relative rounded-3xl border border-white/[0.15] overflow-hidden">
                {/* Content Header Glow */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

                <div className="p-4 md:p-8 overflow-x-auto">
                  {tab === "single" && <TextAnalyzer />}
                  {tab === "drift" && <DriftAnalyzer />}
                  {tab === "timeline" && <TimelineAnalyzer />}
                  {tab === "clusters" && <ClustersAnalyzer />}
                  {tab === "audio" && <AudioShiftAnalyzer />}
                  {tab === "video" && <VideoShiftAnalyzer />}
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Sparkles size={20} />
                Advanced Capabilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <DashboardCard
                  title="Pattern Recognition"
                  description="Detects subtle patterns and anomalies across multimodal data streams"
                  icon={Activity}
                  gradient="from-cyan-500/20 to-blue-500/20"
                />
                <DashboardCard
                  title="Temporal Analysis"
                  description="Tracks behavioral shifts and consistency over time with precision"
                  icon={Clock}
                  gradient="from-purple-500/20 to-pink-500/20"
                />
                <DashboardCard
                  title="Signal Validation"
                  description="Cross-validates findings across multiple analysis dimensions"
                  icon={Shield}
                  gradient="from-emerald-500/20 to-teal-500/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/[0.08]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-white/50 text-center md:text-left">
              <p className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2">
                <span className="flex items-center gap-1"><Shield size={14} /> PersonaLens is designed for exploratory analysis only.</span>
                <span className="hidden md:inline">•</span>
                <span>Not for diagnostic, medical, or deception detection purposes.</span>
              </p>
              <p className="mt-2 text-white/40">
                © {new Date().getFullYear()} PersonaLens v1.0 • Advanced Behavioral Analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-xs text-white/40 hover:text-white/60 transition-colors">
                Privacy
              </button>
              <button className="text-xs text-white/40 hover:text-white/60 transition-colors">
                Terms
              </button>
              <button className="text-xs text-white/40 hover:text-white/60 transition-colors">
                Documentation
              </button>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}