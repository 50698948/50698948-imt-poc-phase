"use client";

import { useState } from "react";

const API = "http://localhost:8000";

const STAGE_COLORS = ["from-indigo-600 to-blue-600", "from-cyan-600 to-teal-600", "from-yellow-600 to-orange-600", "from-emerald-600 to-green-600"];

export default function LifecyclePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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
          <p className="text-gray-500 text-xs mt-1">Simulate incident evolution — embedding quality improves with richer data</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-200 shadow-lg shadow-cyan-900/30">
          <span>{loading ? "◷" : "▶"}</span> {loading ? "Running 4 Stages..." : "Run Lifecycle Demo"}
        </button>
      </div>

      {!data && !loading && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">◷</div>
          <p className="text-gray-500 text-sm mb-2">No lifecycle data yet</p>
          <p className="text-gray-600 text-xs">Click "Run Lifecycle Demo" to simulate a 4-stage incident evolution</p>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-shimmer h-48" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* Score Trend */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-4">Rerank Score Trend</h3>
            <div className="flex items-end gap-4 h-40">
              {data.stages?.map((s: any, i: number) => {
                const h = Math.max(8, (s.avg_rerank_score / 25) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-cyan-400 text-xl font-bold tabular-nums">{s.avg_rerank_score}</span>
                    <div className={`w-full rounded-t-lg bg-gradient-to-t ${STAGE_COLORS[i]} transition-all duration-700`} style={{ height: `${h}%`, minHeight: 4 }} />
                    <span className="text-gray-500 text-[10px] text-center leading-tight">{s.stage?.split(" — ")[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Cards */}
          <div className="space-y-4">
            {data.stages?.map((s: any, i: number) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden card-hover animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                {/* Stage Header */}
                <div className={`bg-gradient-to-r ${STAGE_COLORS[i]} px-5 py-3 flex items-center justify-between`}>
                  <div>
                    <span className="text-white font-bold text-sm">{s.stage}</span>
                    <span className={`ml-3 text-xs px-2 py-0.5 rounded-full bg-white/20 text-white`}>{s.status}</span>
                  </div>
                  <div className="text-right text-white/80 text-xs">
                    <span>v{s.version}</span>
                    <span className="ml-3 font-bold tabular-nums">score: {s.avg_rerank_score}</span>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-gray-400 text-xs leading-relaxed mb-4">{s.description?.slice(0, 250)}...</p>

                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {s.top5_reranked?.map((r: any, j: number) => (
                      <div key={j} className="bg-gray-800/50 rounded-lg p-2.5 border border-gray-800 hover:border-gray-700 transition-colors">
                        <div className="text-cyan-400 text-[10px] font-bold font-mono">{r.incident_no}</div>
                        <div className="text-yellow-400 text-xs font-bold mt-0.5">{r.score?.toFixed(1)}</div>
                        <div className="text-gray-500 text-[9px] leading-tight mt-1 line-clamp-2">{r.title}</div>
                      </div>
                    ))}
                  </div>

                  {s.report_highlights?.length > 0 && (
                    <div className="bg-gray-800/30 rounded-lg p-3 mb-3 border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Report Demo</div>
                      {s.report_highlights.map((h: string, k: number) => (
                        <div key={k} className="text-[10px] text-gray-400 leading-relaxed">• {h}</div>
                      ))}
                    </div>
                  )}

                  {s.tasks?.length > 0 && (
                    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-800">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">Tasks ({s.tasks.length})</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {s.tasks.map((t: any, k: number) => (
                          <div key={k} className="flex items-start gap-1.5 text-[10px] text-gray-500">
                            <span className="text-gray-600 mt-0.5">○</span>
                            <span className="leading-relaxed">T{t.task_order}. {t.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
