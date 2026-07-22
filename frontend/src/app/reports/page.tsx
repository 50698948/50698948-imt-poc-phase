"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [reports, setReports] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSummary, setEditSummary] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdx, setCompareIdx] = useState(0);

  useEffect(() => { fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents); }, []);

  const loadReports = async (no: string) => {
    setSelected(no); setReports([]); setActiveIdx(0); setEditMode(false); setCompareMode(false);
    try {
      const data = await fetch(`${API}/api/reports/${no}`).then((r) => r.json());
      if (Array.isArray(data) && data.length > 0) { setReports(data); setActiveIdx(data.length - 1); }
    } catch {}
  };

  const generateReport = async () => {
    if (!selected) return; setGenerating(true);
    try { await fetch(`${API}/api/reports/${selected}/generate`, { method: "POST" }); await loadReports(selected); } catch {}
    setGenerating(false);
  };

  const publishReport = async () => {
    if (!selected || reports.length === 0) return; setGenerating(true);
    try {
      const body: any = { published_by: "demo-user" };
      if (editSummary) body.executive_summary = editSummary;
      await fetch(`${API}/api/reports/${selected}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await loadReports(selected); setEditMode(false);
    } catch {}
    setGenerating(false);
  };

  const filtered = incidents.filter((t: any) => searchText ? `${t.incident_no} ${t.title}`.toLowerCase().includes(searchText.toLowerCase()) : true);
  const displayed = showAll ? filtered : filtered.slice(0, 10);
  const r = reports[activeIdx];
  const cr = compareMode ? reports[compareIdx] : null;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>

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
            <th className="text-center px-3 py-2 w-8"></th><th className="text-left px-2 py-2 w-36">Incident</th><th className="text-left px-2 py-2">Title</th><th className="text-center px-2 py-2 w-16">Status</th><th className="text-center px-2 py-2 w-12">Sev</th><th className="text-left px-2 py-2 w-24">Service</th><th className="text-center px-3 py-2 w-16">Reports</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.map((t: any) => (
              <tr key={t.incident_no} onClick={() => loadReports(t.incident_no)}
                className={`cursor-pointer transition-colors ${selected === t.incident_no ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={selected === t.incident_no} onChange={() => loadReports(t.incident_no)} className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer" /></td>
                <td className="px-2 py-2.5"><span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span></td>
                <td className="px-2 py-2.5 text-gray-700 max-w-xs truncate">{t.title}</td>
                <td className="px-2 py-2.5 text-center"><span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${t.status==="resolved"?"bg-emerald-50 text-emerald-600":t.status==="investigating"?"bg-amber-50 text-amber-600":"bg-red-50 text-red-600"}`}>{t.status}</span></td>
                <td className="px-2 py-2.5 text-center"><span className={`text-[9px] font-bold ${t.severity==="P0"?"text-red-500":t.severity==="P1"?"text-orange-500":"text-gray-500"}`}>{t.severity}</span></td>
                <td className="px-2 py-2.5 text-gray-500 text-[10px]">{t.service_name}</td>
                <td className="px-3 py-2.5 text-center text-gray-400 text-[10px]">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 10 && (
          <button onClick={() => setShowAll(!showAll)} className="w-full text-center py-2 text-[10px] text-gray-400 hover:text-gray-600 border-t border-gray-50">
            {showAll ? "Show fewer" : `Show all ${filtered.length} incidents`}
          </button>
        )}
      </div>

      {/* ── Report Board ── */}
      {!selected ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">▤</div><p className="text-gray-500 text-sm">Select an incident above to view reports</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-3xl mb-3">📭</div><p className="text-gray-500 text-sm mb-1">No reports for <span className="text-indigo-600 font-bold">{selected}</span></p>
          <button onClick={generateReport} disabled={generating} className="btn-brand text-xs">{generating ? "Generating..." : "Generate Report"}</button>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-700">
                  <span className="text-indigo-600 font-mono">{selected}</span>
                  <span className="text-gray-400 ml-2">— {reports.length} reports</span>
                </span>
                <div className="flex items-center gap-1">
                  {reports.map((rp: any, i: number) => (
                    <button key={i} onClick={() => setActiveIdx(i)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${i === activeIdx ? "bg-indigo-100 text-indigo-600" : "bg-gray-50 text-gray-400 hover:text-gray-600"}`}>
                      v{rp.ticket_version}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setCompareMode(!compareMode); if (!compareMode) setCompareIdx(Math.max(0, activeIdx - 1)); }}
                  className={`text-[10px] border rounded-lg px-2.5 py-1.5 font-medium ${compareMode ? "bg-purple-50 text-purple-600 border-purple-200" : "text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                  {compareMode ? "Exit Compare" : "Compare"}
                </button>
                <button onClick={() => { setEditMode(!editMode); if (!editMode && r) setEditSummary(r.content?.split("## 2.")[0]?.replace("## 1. Executive Summary\n","")?.trim() || ""); }}
                  className={`text-[10px] border rounded-lg px-2.5 py-1.5 font-medium ${editMode ? "bg-amber-50 text-amber-600 border-amber-200" : "text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                  {editMode ? "Cancel Edit" : "Revise"}
                </button>
                <button onClick={generateReport} disabled={generating} className="text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium">⟳ Generate</button>
                <button onClick={publishReport} disabled={generating} className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-3 py-1.5 font-medium">Publish</button>
              </div>
            </div>
            {r && <div className="text-[10px] text-gray-400 mt-2">Generated: {r.generated_at?.slice(0,16)} · Status: <span className="text-indigo-600 font-bold">{r.report_status || "draft"}</span></div>}
          </div>

          {/* Compare Mode */}
          {compareMode && cr && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="text-[10px] text-purple-400 uppercase font-bold mb-2">v{cr.ticket_version} (previous)</div>
                <div className="space-y-1">
                  {cr.highlights?.map((h: string, i: number) => {
                    const removed = !r.highlights?.includes(h);
                    return <div key={i} className={`text-[10px] border rounded-lg px-2 py-1.5 ${removed ? "bg-red-50 border-red-200 text-red-500 line-through" : "bg-gray-50 border-gray-100 text-gray-500"}`}>• {h}</div>;
                  })}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="text-[10px] text-indigo-400 uppercase font-bold mb-2">v{r.ticket_version} (current)</div>
                <div className="space-y-1">
                  {r.highlights?.map((h: string, i: number) => {
                    const added = !cr.highlights?.includes(h);
                    return <div key={i} className={`text-[10px] border rounded-lg px-2 py-1.5 ${added ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-gray-50 border-gray-100 text-gray-500"}`}>• {added && <span className="font-bold">+ </span>}{h}</div>;
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Edit Mode */}
          {editMode && r && (
            <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-3">
              <div className="text-[10px] text-amber-600 uppercase font-bold mb-2">Revise Report</div>
              <label className="text-[9px] text-gray-500 uppercase block mb-1">Executive Summary</label>
              <textarea value={editSummary} onChange={(e) => setEditSummary(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 h-24 resize-none focus:outline-none focus:border-amber-300 mb-3" />
              <label className="text-[9px] text-gray-500 uppercase block mb-1">Highlights (edit in-place below)</label>
              <button onClick={publishReport} disabled={generating} className="btn-brand text-xs mt-2">Save & Publish</button>
            </div>
          )}

          {/* Report Content */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5">
              <div className="mb-5">
                <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Key Highlights</h3>
                <div className="space-y-1.5">
                  {r?.highlights?.map((h: string, i: number) => {
                    const tagMatch = h.match(/^\[([\w\s]+)\]/); const tag = tagMatch ? tagMatch[1].trim() : "";
                    const tc: Record<string, string> = { STATUS: "bg-blue-50 text-blue-600 border-blue-200", "ROOT CAUSE": "bg-red-50 text-red-600 border-red-200", ACTION: "bg-emerald-50 text-emerald-600 border-emerald-200", REFERENCE: "bg-amber-50 text-amber-600 border-amber-200", NEXT: "bg-gray-100 text-gray-600 border-gray-200" };
                    return <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-xs">{tag && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 border ${tc[tag]||"bg-gray-100 text-gray-500"}`}>{tag}</span>}<span className="text-gray-600 leading-relaxed">{h.replace(/^\[[\w\s]*\]\s*/, "")}</span></div>;
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Full Report</h3>
                <pre className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-[10px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto font-mono">{r?.content}</pre>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
