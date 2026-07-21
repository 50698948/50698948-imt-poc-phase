"use client";

import { useState } from "react";
import Link from "next/link";

const API = "http://localhost:8000";

const STAGE_COLORS = [
  { line: "bg-indigo-500", dot: "bg-indigo-500", glow: "shadow-indigo-500/50", headerFrom: "from-indigo-600", headerTo: "to-blue-600" },
  { line: "bg-cyan-500", dot: "bg-cyan-500", glow: "shadow-cyan-500/50", headerFrom: "from-cyan-600", headerTo: "to-teal-600" },
  { line: "bg-amber-500", dot: "bg-amber-500", glow: "shadow-amber-500/50", headerFrom: "from-amber-600", headerTo: "to-orange-600" },
  { line: "bg-emerald-500", dot: "bg-emerald-500", glow: "shadow-emerald-500/50", headerFrom: "from-emerald-600", headerTo: "to-green-600" },
];

function StageCard({ stage, index, defaultExpanded }: { stage: any; index: number; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const g = STAGE_COLORS[index];

  const statusColor: Record<string, string> = {
    open: "bg-red-950/40 text-red-300 border-red-800/50",
    investigating: "bg-yellow-950/40 text-yellow-300 border-yellow-800/50",
    mitigated: "bg-blue-950/40 text-blue-300 border-blue-800/50",
    resolved: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
  };

  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
      {/* Collapsed Header */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden transition-all duration-200 group">
        <div className={`bg-gradient-to-r ${g.headerFrom} ${g.headerTo} px-4 py-2.5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-white text-xs font-mono opacity-70">{stage.stage?.split(" — ")[0]}</span>
            <span className="text-white font-bold text-sm">{stage.stage}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor[stage.status] || "bg-white/20 text-white"}`}>
              {stage.status}
            </span>
            <span className="text-white/60 text-xs font-mono">v{stage.version}</span>
            <span className="text-yellow-200 font-bold text-sm tabular-nums ml-2">score {stage.avg_rerank_score}</span>
            <span className={`text-white/70 text-sm transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}>▶</span>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {/* Description */}
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Current Description</div>
            <p className="text-gray-400 text-xs leading-relaxed">{stage.description}</p>
            {stage.root_cause && (
              <div className="mt-2 bg-purple-950/20 border border-purple-900/30 rounded-lg px-3 py-2">
                <span className="text-purple-400 text-[10px] font-bold">Root Cause: </span>
                <span className="text-purple-300 text-xs">{stage.root_cause}</span>
              </div>
            )}
            {stage.resolution && (
              <div className="mt-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-3 py-2">
                <span className="text-emerald-400 text-[10px] font-bold">Resolution: </span>
                <span className="text-emerald-300 text-xs">{stage.resolution}</span>
              </div>
            )}
          </div>

          {/* Top-5 Matches */}
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Top-5 Similar Historical Tickets</div>
            <div className="grid grid-cols-5 gap-2">
              {stage.top5_reranked?.map((r: any, j: number) => (
                <Link key={j} href={`/incident/${r.incident_no}`}
                  className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-800 hover:border-cyan-700 hover:bg-gray-800 transition-all cursor-pointer block group">
                  <div className="text-cyan-400 text-[10px] font-bold font-mono group-hover:text-cyan-300">{r.incident_no}</div>
                  <div className="text-yellow-400 text-xs font-bold mt-0.5">{r.score?.toFixed(1)}</div>
                  <div className="text-gray-500 text-[9px] leading-tight mt-1 line-clamp-2 group-hover:text-gray-400">{r.title}</div>
                  <div className="text-gray-600 text-[8px] mt-1 truncate">{r.reason}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Report + Tasks side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800">
              <div className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold mb-1.5">Report Demo</div>
              {stage.report_highlights?.length > 0
                ? stage.report_highlights.map((h: string, k: number) => {
                    const tag = h.match(/^\[(\w[\w\s]*)\]/)?.[1] || "";
                    return (
                      <div key={k} className="text-[10px] text-gray-400 leading-relaxed mb-0.5">
                        {tag && <span className="text-cyan-500 font-bold mr-1">[{tag}]</span>}
                        {h.replace(/^\[[\w\s]*\]\s*/, "")}
                      </div>
                    );
                  })
                : <div className="text-[10px] text-gray-600 italic">No report — generated on first update</div>
              }
            </div>
            <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800">
              <div className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold mb-1.5">Tasks ({stage.tasks?.length || 0})</div>
              {stage.tasks?.length > 0 ? (
                <div className="space-y-0.5">
                  {stage.tasks.map((t: any, k: number) => (
                    <div key={k} className="flex items-start gap-1.5 text-[10px] text-gray-500">
                      <span className="text-gray-600 mt-0.5 shrink-0">○</span>
                      <span className="leading-relaxed">T{t.task_order}. {t.description}</span>
                      <span className="text-gray-700 text-[8px] shrink-0 ml-auto">{t.source}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-gray-600 italic">No tasks — generated on first update</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LifecyclePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandAll, setExpandAll] = useState(true);

  const run = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/seed`, { method: "POST" });
      const res = await fetch(`${API}/api/lifecycle`, { method: "POST" });
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lifecycle Demo</h1>
          <p className="text-gray-500 text-xs mt-1">Simulate incident evolution — click stage headers to expand/collapse</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpandAll(!expandAll)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600">
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-bold transition-all shadow-lg shadow-cyan-900/30">
            <span>{loading ? "◷" : "▶"}</span> {loading ? "Running 4 Stages..." : "Run Lifecycle Demo"}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div className="text-center py-24">
          <div className="text-6xl mb-4">◷</div>
          <p className="text-gray-500 text-sm mb-2">No lifecycle data yet</p>
          <p className="text-gray-600 text-xs">Click "Run Lifecycle Demo" to simulate a 4-stage incident evolution</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-shimmer h-16" />
          ))}
        </div>
      )}

      {data && (
        <div className="relative">
          {/* Score Bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-end gap-4 h-24">
              {data.stages?.map((s: any, i: number) => {
                const h = Math.max(6, (s.avg_rerank_score / 25) * 100);
                const g = STAGE_COLORS[i];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-cyan-400 text-lg font-bold tabular-nums">{s.avg_rerank_score}</span>
                    <div className={`w-full rounded-t-lg bg-gradient-to-t ${g.headerFrom} ${g.headerTo} transition-all duration-700`} style={{ height: `${h}%` }} />
                    <span className="text-gray-500 text-[10px]">{s.stage?.split(" — ")[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vertical Timeline */}
          <div className="relative pl-12">
            {/* Gradient vertical line */}
            <div className="absolute left-[22px] top-10 bottom-8 w-0.5 bg-gradient-to-b from-indigo-500 via-cyan-500 via-amber-500 to-emerald-500" />

            <div className="space-y-3">
              {data.stages?.map((s: any, i: number) => (
                <div key={i} className="relative">
                  {/* Timeline dot + connector */}
                  <div className={`absolute left-[-30px] top-4 w-4 h-4 rounded-full border-[3px] border-gray-950 ${STAGE_COLORS[i].dot} ${STAGE_COLORS[i].glow} shadow-lg z-10`} />

                  {/* Time label */}
                  <div className="absolute left-[-72px] top-[14px] text-[9px] text-gray-600 font-mono w-10 text-right">
                    {s.stage?.split(" — ")[0]}
                  </div>

                  {/* Card */}
                  <StageCard stage={s} index={i} defaultExpanded={expandAll} />
                </div>
              ))}
            </div>
          </div>

          {/* Flow indicator */}
          <div className="flex items-center justify-center gap-2 mt-6 text-[10px] text-gray-700">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-gray-600">T+0</span>
            <span className="text-gray-800">→</span>
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-gray-600">T+10</span>
            <span className="text-gray-800">→</span>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-gray-600">T+45</span>
            <span className="text-gray-800">→</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-600">T+90</span>
            <span className="ml-2 text-gray-600">— Incident Lifecycle ({data.stages?.length} stages)</span>
          </div>
        </div>
      )}
    </div>
  );
}
