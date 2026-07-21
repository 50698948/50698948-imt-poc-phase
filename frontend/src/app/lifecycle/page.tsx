"use client";

import { useState } from "react";

const API = "http://localhost:8000";

const STATUS_COLOR: Record<string, string> = {
  open: "text-red-400",
  investigating: "text-yellow-400",
  mitigated: "text-blue-400",
  resolved: "text-green-400",
};

export default function LifecyclePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/seed`, { method: "POST" });
      const res = await fetch(`${API}/api/lifecycle`, { method: "POST" });
      setData(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl text-cyan-400 font-bold">Lifecycle Demo</h1>
          <p className="text-gray-500 text-xs mt-1">4-stage incident evolution with dynamic re-embedding</p>
        </div>
        <button onClick={run} disabled={loading}
          className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-bold uppercase">
          {loading ? "Running 4 Stages..." : "Run Lifecycle Demo"}
        </button>
      </div>

      {data && (
        <>
          {/* Score Trend Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-3">Rerank Score Trend</div>
            <div className="flex items-end gap-6 h-32">
              {data.stages?.map((s: any, i: number) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-cyan-400 text-lg font-bold">{s.avg_rerank_score}</span>
                  <div className="w-full bg-cyan-700 rounded-t" style={{ height: `${(s.avg_rerank_score / 25) * 100}%` }} />
                  <span className="text-gray-500 text-[10px]">{s.stage?.split(" — ")[0]}</span>
                  <span className={`text-[10px] ${STATUS_COLOR[s.status] || ""}`}>v{s.version} {s.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage Cards */}
          {data.stages?.map((s: any, i: number) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-cyan-400 font-bold text-sm">{s.stage}</span>
                <span className={`text-xs ${STATUS_COLOR[s.status] || ""}`}>{s.status}</span>
                <span className="text-gray-600 text-xs">v{s.version}</span>
                <span className="text-yellow-400 text-xs ml-auto">score avg: {s.avg_rerank_score}</span>
              </div>

              <p className="text-gray-400 text-xs mb-2">{s.description?.slice(0, 200)}...</p>

              {/* Top-5 Reranked */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {s.top5_reranked?.map((r: any, j: number) => (
                  <div key={j} className="bg-gray-800 rounded p-2">
                    <div className="text-cyan-400 text-[10px] font-bold">{r.incident_no}</div>
                    <div className="text-yellow-400 text-[10px]">{r.score?.toFixed(1)}</div>
                    <div className="text-gray-500 text-[9px] truncate">{r.title}</div>
                  </div>
                ))}
              </div>

              {/* Report Highlights */}
              {s.report_highlights?.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 uppercase mb-1">Report Demo</div>
                  {s.report_highlights.map((h: string, k: number) => (
                    <div key={k} className="text-[10px] text-gray-400">* {h}</div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {s.tasks?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">Tasks ({s.tasks.length})</div>
                  <div className="grid grid-cols-2 gap-1">
                    {s.tasks.map((t: any, k: number) => (
                      <div key={k} className="text-[10px] text-gray-500 flex gap-1">
                        <span className="text-gray-600">[ ]</span>
                        <span className="truncate">T{t.task_order}. {t.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
