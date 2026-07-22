"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

const EVENT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  created: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: "●", label: "Created" },
  report: { color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", icon: "📄", label: "Report" },
  tasks: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: "📋", label: "Tasks" },
};

export default function LifecyclePage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [timeline, setTimeline] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents); }, []);

  const loadTimeline = async (no: string) => {
    setSelected(no); setLoading(true); setExpandedIdx(null);
    try {
      const [tR, tlR] = await Promise.all([fetch(`${API}/api/tickets/${no}`), fetch(`${API}/api/incidents/${no}/timeline`)]);
      setTicket(await tR.json()); setTimeline(await tlR.json());
    } catch { setTimeline(null); setTicket(null); }
    setLoading(false);
  };

  const runDemo = async () => {
    setLoading(true);
    try { await fetch(`${API}/api/seed`, { method: "POST" }); await fetch(`${API}/api/lifecycle`, { method: "POST" }); await loadTimeline("INC-2025-0001"); } catch {}
    setLoading(false);
  };

  const filtered = incidents.filter((t: any) => searchText ? `${t.incident_no} ${t.title}`.toLowerCase().includes(searchText.toLowerCase()) : true);
  const displayed = showAll ? filtered : filtered.slice(0, 10);

  const events = timeline?.events ? [...timeline.events].sort((a: any, b: any) => (a.time || "").localeCompare(b.time || "")) : [];
  const created = events.find((e: any) => e.type === "created");

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Lifecycle</h1><p className="text-gray-500 text-xs mt-1">View incident event timeline — select from table or run demo</p></div>
        <button onClick={runDemo} disabled={loading} className="btn-brand flex items-center gap-2 text-xs">{loading ? "◷" : "▶"} Run Demo</button>
      </div>

      {/* ── Incident Table ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Incidents</h2>
            <span className="text-[10px] text-gray-400">{filtered.length} total</span>
          </div>
          <div className="relative">
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Filter..."
              className="bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-gray-600 w-48 focus:outline-none focus:border-indigo-300" />
            <span className="absolute left-2 top-1.5 text-gray-400 text-[11px]">🔍</span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-gray-100 bg-gray-50/30 text-gray-400 uppercase tracking-wider text-[10px]">
            <th className="text-center px-3 py-2 w-8"></th><th className="text-left px-2 py-2 w-36">Incident</th><th className="text-left px-2 py-2">Title</th><th className="text-center px-2 py-2 w-16">Status</th><th className="text-center px-2 py-2 w-12">Sev</th><th className="text-left px-2 py-2 w-24">Service</th><th className="text-center px-3 py-2 w-16">Events</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.map((t: any) => (
              <tr key={t.incident_no} onClick={() => loadTimeline(t.incident_no)}
                className={`cursor-pointer transition-colors ${selected === t.incident_no ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={selected === t.incident_no} onChange={() => loadTimeline(t.incident_no)} className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer" /></td>
                <td className="px-2 py-2.5"><span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span></td>
                <td className="px-2 py-2.5 text-gray-700 max-w-xs truncate">{t.title}</td>
                <td className="px-2 py-2.5 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${t.status==="resolved"?"bg-emerald-50 text-emerald-600":t.status==="investigating"?"bg-amber-50 text-amber-600":"bg-red-50 text-red-600"}`}>{t.status}</span></td>
                <td className="px-2 py-2.5 text-center"><span className={`text-[9px] font-bold ${t.severity === "P0" ? "text-red-500" : t.severity === "P1" ? "text-orange-500" : "text-gray-500"}`}>{t.severity}</span></td>
                <td className="px-2 py-2.5 text-gray-500 text-[10px]">{t.service_name}</td>
                <td className="px-3 py-2.5 text-center text-gray-400 text-[10px]">{t.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 10 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full text-center py-2 text-[10px] text-gray-400 hover:text-gray-600 border-t border-gray-50">{showAll ? "Show fewer" : `Show all ${filtered.length}`}</button>
        )}
      </div>

      {/* ── Timeline ── */}
      {!selected ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">◷</div><p className="text-gray-500 text-sm mb-1">Select an incident or run demo</p><p className="text-gray-400 text-xs">Timeline shows all events: creation, report generation, task generation</p>
        </div>
      ) : loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8"><div className="animate-shimmer h-48 rounded-lg" /></div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-indigo-600 font-bold text-lg font-mono">{timeline?.incident_no}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${timeline?.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{timeline?.status}</span>
                  <span className="text-gray-400 text-xs font-mono">v{timeline?.version}</span>
                </div>
                <h1 className="text-gray-800 text-sm font-medium">{timeline?.title}</h1>
              </div>
              <div className="text-right"><div className="text-[10px] text-gray-400">Created</div><div className="text-xs text-gray-600 font-mono">{created?.time?.slice(0,16)||"—"}</div></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[{label:"Events",value:events.length,color:"text-gray-700"},{label:"Created",value:events.filter((e:any)=>e.type==="created").length,color:"text-emerald-600"},{label:"Reports",value:events.filter((e:any)=>e.type==="report").length,color:"text-indigo-600"},{label:"Tasks",value:events.filter((e:any)=>e.type==="tasks").length,color:"text-amber-600"}].map((s,i)=>(
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center"><div className={`text-xl font-bold ${s.color}`}>{s.value}</div><div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div></div>
            ))}
          </div>

          {/* Vertical Timeline */}
          <div className="relative">
            <div className="absolute left-[19px] top-3 bottom-8 w-0.5 bg-gray-200" />
            <div className="space-y-1">
              {events.map((event: any, i: number) => {
                const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.created;
                const isExpanded = expandedIdx === i;
                const timeStr = event.time?.slice(11,16)||"";
                const dateStr = event.time?.slice(0,10)||"";
                return (
                  <div key={i} className="relative pl-12 animate-fade-in" style={{ animationDelay: `${i*50}ms` }}>
                    <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      className={`absolute left-[11px] top-[18px] w-[18px] h-[18px] rounded-full border-[3px] border-white shadow-sm z-10 flex items-center justify-center transition-all hover:scale-125 ${cfg.bg} ${cfg.border}`}>
                      <span className="text-[9px]">{cfg.icon}</span>
                    </button>
                    <div className="text-[10px] text-gray-400 font-mono mb-1 mt-2">{timeStr}{dateStr !== events[0]?.time?.slice(0,10) && <span className="text-gray-300 ml-1">{dateStr}</span>}</div>
                    <div className="ml-1">
                      <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-gray-500">{event.title}</span>
                        </div>
                        {isExpanded && (
                          <div className={`mt-3 ${cfg.bg} rounded-lg p-3 border ${cfg.border}`}>
                            <p className="text-[10px] text-gray-600 leading-relaxed whitespace-pre-wrap">{event.detail}</p>
                            {event.type === "report" && event.detail && (
                              <div className="mt-2 space-y-0.5">{event.detail.split("|").map((h:string,j:number)=>(<div key={j} className="text-[9px] text-gray-500">• {h.trim()}</div>))}</div>
                            )}
                            <div className="text-[8px] text-gray-400 mt-2">{event.time}</div>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full Details */}
          {ticket && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-6 space-y-4">
              <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Description</h3><p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap">{ticket.description}</p></div>
              {ticket.root_cause && <div className="border-t border-gray-100 pt-4"><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Root Cause</h3><div className="bg-red-50 border border-red-100 rounded-lg p-3"><p className="text-gray-700 text-xs leading-relaxed">{ticket.root_cause}</p></div></div>}
              {ticket.resolution && <div className="border-t border-gray-100 pt-4"><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Resolution</h3><div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3"><p className="text-gray-700 text-xs leading-relaxed">{ticket.resolution}</p></div></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
