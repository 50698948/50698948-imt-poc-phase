"use client";

import { useState } from "react";
import Link from "next/link";

const API = "http://localhost:8000";
const STAGE_COLORS = [
  { header: "bg-indigo-500", dot: "bg-indigo-400", line: "bg-indigo-300" },
  { header: "bg-cyan-500", dot: "bg-cyan-400", line: "bg-cyan-300" },
  { header: "bg-amber-500", dot: "bg-amber-400", line: "bg-amber-300" },
  { header: "bg-emerald-500", dot: "bg-emerald-400", line: "bg-emerald-300" },
];

function StageCard({ stage, index, defaultExpanded }: { stage: any; index: number; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const g = STAGE_COLORS[index];
  return (
    <div className="animate-fade-in" style={{ animationDelay: `${index * 80}ms` }}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 rounded-xl overflow-hidden transition-all">
        <div className={`${g.header} px-4 py-2.5 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-white/70 text-xs font-mono">{stage.stage?.split(" — ")[0]}</span>
            <span className="text-white font-semibold text-sm">{stage.stage}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white`}>{stage.status}</span>
            <span className="text-white/60 text-xs font-mono">v{stage.version}</span>
            <span className="text-white font-bold text-sm">score {stage.avg_rerank_score}</span>
            <span className={`text-white/70 text-sm transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
          </div>
        </div>
      </button>
      <div className={`overflow-hidden transition-all ${expanded ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <p className="text-gray-600 text-xs leading-relaxed mb-4">{stage.description?.slice(0, 300)}...</p>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {stage.top5_reranked?.map((r: any, j: number) => (
              <Link key={j} href={`/incident/${r.incident_no}`}
                className="bg-gray-50 rounded-lg p-2.5 border border-gray-100 hover:border-indigo-200 transition-all block group">
                <div className="text-indigo-600 text-[10px] font-bold font-mono group-hover:text-indigo-500">{r.incident_no}</div>
                <div className="text-amber-600 text-xs font-bold mt-0.5">{r.score?.toFixed(1)}</div>
                <div className="text-gray-500 text-[9px] leading-tight mt-1 line-clamp-2">{r.title}</div>
              </Link>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Report</div>
              {stage.report_highlights?.map((h: string, k: number) => (<div key={k} className="text-[10px] text-gray-500 leading-relaxed">• {h}</div>)) || <div className="text-[10px] text-gray-400 italic">—</div>}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Tasks ({stage.tasks?.length || 0})</div>
              {stage.tasks?.slice(0, 4).map((t: any, k: number) => (<div key={k} className="text-[10px] text-gray-500 leading-relaxed">○ T{t.task_order}. {t.description}</div>))}
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
  const run = async () => { setLoading(true); try { await fetch(`${API}/api/seed`, { method: "POST" }); setData(await (await fetch(`${API}/api/lifecycle`, { method: "POST" })).json()); } catch(e){} setLoading(false); };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Lifecycle Demo</h1><p className="text-gray-500 text-xs mt-1">Simulate incident evolution — click stage headers to expand</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpandAll(!expandAll)} className="btn-secondary text-xs">{expandAll ? "Collapse All" : "Expand All"}</button>
          <button onClick={run} disabled={loading} className="btn-brand flex items-center gap-2 text-sm">{loading ? "◷" : "▶"} {loading ? "Running..." : "Run Lifecycle"}</button>
        </div>
      </div>
      {!data && !loading && (<div className="text-center py-24"><div className="text-5xl mb-4">◷</div><p className="text-gray-500">No lifecycle data yet</p></div>)}
      {loading && (<div className="space-y-4">{Array.from({length:4}).map((_,i)=>(<div key={i} className="bg-white border border-gray-100 rounded-xl p-6 animate-shimmer h-16"/>))}</div>)}
      {data && (
        <div className="relative">
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-end gap-4 h-24">
              {data.stages?.map((s:any,i:number)=>{const h=Math.max(6,(s.avg_rerank_score/25)*100);const g=STAGE_COLORS[i];return(<div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"><span className="text-indigo-600 text-lg font-bold">{s.avg_rerank_score}</span><div className={`w-full rounded-t-lg ${g.header} transition-all duration-700`} style={{height:`${h}%`}}/><span className="text-gray-400 text-[10px]">{s.stage?.split(" — ")[0]}</span></div>)})}
            </div>
          </div>
          <div className="relative pl-12">
            <div className="absolute left-[22px] top-10 bottom-8 w-0.5 bg-gradient-to-b from-indigo-300 via-cyan-300 via-amber-300 to-emerald-300"/>
            <div className="space-y-3">
              {data.stages?.map((s:any,i:number)=>(
                <div key={i} className="relative">
                  <div className={`absolute left-[-30px] top-4 w-4 h-4 rounded-full border-[3px] border-white ${STAGE_COLORS[i].dot} shadow-sm z-10`}/>
                  <div className="absolute left-[-72px] top-[14px] text-[9px] text-gray-400 font-mono w-10 text-right">{s.stage?.split(" — ")[0]}</div>
                  <StageCard stage={s} index={i} defaultExpanded={expandAll}/>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-6 text-[10px] text-gray-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400"/><span>T+0</span><span>→</span><span className="w-2 h-2 rounded-full bg-cyan-400"/><span>T+10</span><span>→</span><span className="w-2 h-2 rounded-full bg-amber-400"/><span>T+45</span><span>→</span><span className="w-2 h-2 rounded-full bg-emerald-400"/><span>T+90</span><span className="ml-2">— {data.stages?.length} stages</span>
          </div>
        </div>
      )}
    </div>
  );
}
