"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [reports, setReports] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents);
  }, []);

  const filtered = incidents.filter((t: any) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterText && !`${t.incident_no} ${t.title} ${t.service_name}`.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const loadReports = async (no: string) => {
    setSelected(no); setReports([]); setActiveIdx(0);
    try {
      const data = await fetch(`${API}/api/reports/${no}`).then((r) => r.json());
      if (Array.isArray(data) && data.length > 0) { setReports(data); setActiveIdx(data.length - 1); }
    } catch {}
  };

  const generateReport = async () => {
    if (!selected) return;
    setGenerating(true);
    try { await fetch(`${API}/api/reports/${selected}/generate`, { method: "POST" }); await loadReports(selected); } catch (e) { console.error(e); }
    setGenerating(false);
  };

  const publishReport = async () => {
    if (!selected || reports.length === 0) return;
    setGenerating(true);
    try { await fetch(`${API}/api/reports/${selected}/publish`, { method: "POST", body: JSON.stringify({ published_by: "demo-user" }), headers: { "Content-Type": "application/json" } }); await loadReports(selected); } catch {}
    setGenerating(false);
  };

  const r = reports[activeIdx];
  const generatedCount = incidents.filter((t: any) => true).length; // all have potential

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reports</h1>
          <p className="text-gray-500 text-xs mt-1">Browse, filter, generate, and publish leadership reports</p>
        </div>
        <div className="flex items-center gap-2">
          {selected && <button onClick={generateReport} disabled={generating} className="btn-brand text-xs">{generating ? "Generating..." : "⟳ Generate Report"}</button>}
          {selected && r && <button onClick={publishReport} disabled={generating} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-all">Publish</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search incidents..."
            className="w-full bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" />
          <span className="absolute left-2.5 top-1.5 text-gray-400 text-xs">🔍</span>
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:border-indigo-300">
          <option value="">All Status</option><option value="open">Open</option><option value="investigating">Investigating</option><option value="mitigated">Mitigated</option><option value="resolved">Resolved</option>
        </select>
        <span className="text-[10px] text-gray-400">{filtered.length} incidents</span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Incident list */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Incidents</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-50">
            {filtered.map((t: any) => (
              <button key={t.incident_no} onClick={() => loadReports(t.incident_no)}
                className={`w-full text-left px-3 py-2.5 transition-colors text-xs ${selected === t.incident_no ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-gray-50 border-l-2 border-transparent"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${t.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{t.status}</span>
                </div>
                <div className="text-gray-600 text-[10px] truncate">{t.title}</div>
                <div className="text-gray-400 text-[8px] mt-0.5">{t.service_name} · {t.category}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-8 text-center text-gray-400 text-xs">No incidents match</div>}
          </div>
        </div>

        {/* Report content */}
        <div className="col-span-9">
          {!selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-4xl mb-3">▤</div>
              <p className="text-gray-500 text-sm mb-1">Select an incident to view its report</p>
              <p className="text-gray-400 text-xs">Use filters above to find specific incidents</p>
            </div>
          ) : !r ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-gray-500 text-sm mb-2">No reports yet for {selected}</p>
              <button onClick={generateReport} disabled={generating} className="btn-brand text-xs">{generating ? "Generating..." : "Generate Report →"}</button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Version tabs */}
              <div className="flex items-center border-b border-gray-100 bg-gray-50/50 px-4">
                {reports.map((rp: any, i: number) => (
                  <button key={i} onClick={() => setActiveIdx(i)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${i === activeIdx ? "text-indigo-600 border-indigo-500" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
                    v{rp.ticket_version}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Meta */}
                <div className="flex items-center gap-4 mb-4 text-[10px] text-gray-500">
                  <span>Generated: {r.generated_at?.slice(0, 16)}</span>
                  <span className="text-indigo-600 font-bold">{r.report_status || "draft"}</span>
                </div>

                {/* Highlights */}
                <div className="mb-5">
                  <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Key Highlights</h3>
                  <div className="space-y-1.5">
                    {r.highlights?.map((h: string, i: number) => {
                      const tagMatch = h.match(/^\[([\w\s]+)\]/);
                      const tag = tagMatch ? tagMatch[1].trim() : "";
                      const tagColors: Record<string, string> = {
                        STATUS: "bg-blue-50 text-blue-600 border-blue-200",
                        "ROOT CAUSE": "bg-red-50 text-red-600 border-red-200",
                        ACTION: "bg-emerald-50 text-emerald-600 border-emerald-200",
                        REFERENCE: "bg-amber-50 text-amber-600 border-amber-200",
                        NEXT: "bg-gray-100 text-gray-600 border-gray-200",
                      };
                      return (
                        <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-xs">
                          {tag && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 border ${tagColors[tag] || "bg-gray-100 text-gray-500 border-gray-200"}`}>{tag}</span>}
                          <span className="text-gray-600 leading-relaxed">{h.replace(/^\[[\w\s]*\]\s*/, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Full report */}
                <div>
                  <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-2">Full Report</h3>
                  <pre className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-[10px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">{r.content}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
