"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [reports, setReports] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents);
  }, []);

  const loadReports = async (incidentNo: string) => {
    try {
      const data = await fetch(`${API}/api/reports/${incidentNo}`).then((r) => r.json());
      if (Array.isArray(data) && data.length > 0) {
        setReports(data);
        setActiveVersion(data.length - 1);
      } else {
        setReports([]);
        setActiveVersion(-1);
      }
    } catch { setReports([]); setActiveVersion(-1); }
  };

  const generateReport = async () => {
    if (!selected) return;
    setGenerating(true);
    try {
      // trigger lifecycle update to force new report generation
      const ticket = await fetch(`${API}/api/tickets/${selected}`).then((r) => r.json());
      // call lifecycle which updates ticket and generates reports
      await fetch(`${API}/api/lifecycle`, { method: "POST" });
      await loadReports(selected);
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  useEffect(() => {
    if (!selected) return;
    setReports([]); setActiveVersion(-1);
    loadReports(selected);
  }, [selected]);

  const activeReport = reports[activeVersion];
  const prevReport = showCompare && activeVersion > 0 ? reports[activeVersion - 1] : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Report Demo</h1>
          <p className="text-gray-500 text-xs mt-1">
            Auto-generated leadership reports on every ticket update — comparing current incident with similar historical tickets
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <>
              <button onClick={() => setShowCompare(!showCompare)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showCompare ? "bg-purple-900/50 text-purple-300 border border-purple-700" : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"}`}>
                {showCompare ? "Hide Diff" : "Compare Versions"}
              </button>
              <button onClick={generateReport} disabled={generating}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 text-xs font-bold transition-all shadow-lg shadow-cyan-900/30">
                {generating ? "◷" : "⟳"} {generating ? "Generating..." : "Generate Report"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Incident List */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Incidents</div>
          <div className="space-y-0.5 max-h-[75vh] overflow-y-auto">
            {incidents.map((t: any) => (
              <button key={t.incident_no} onClick={() => setSelected(t.incident_no)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                  selected === t.incident_no
                    ? "bg-cyan-950/40 text-cyan-300 border border-cyan-800/50"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent"
                }`}>
                <div className="font-mono font-bold text-[10px]">{t.incident_no}</div>
                <div className="text-[9px] text-gray-600 truncate mt-0.5">{t.status} · {t.severity}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        <div className={showCompare ? "col-span-5" : "col-span-7"}>
          {!selected ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-3">▤</div>
              <p className="text-gray-500 text-sm">Select an incident to view reports</p>
              <p className="text-gray-600 text-xs mt-1">Reports are auto-generated on each ticket update</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 text-sm mb-2">No reports yet for {selected}</p>
              <button onClick={generateReport} disabled={generating}
                className="bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all">
                {generating ? "Generating..." : "Generate Report →"}
              </button>
            </div>
          ) : null}

          {activeReport && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Report header */}
              <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <span className="text-cyan-400 font-bold text-sm">REPORT DEMO</span>
                  <span className="text-gray-400 text-xs ml-3">{selected}</span>
                </div>
                <div className="flex items-center gap-1">
                  {reports.map((r, i) => (
                    <button key={i} onClick={() => setActiveVersion(i)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                        i === activeVersion ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-500 hover:text-gray-300"
                      }`}>
                      v{r.ticket_version}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full report template */}
              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                  <div>
                    <span className="text-gray-500">Service:</span>
                    <span className="text-gray-300 ml-2">{selected}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Generated:</span>
                    <span className="text-gray-300 ml-2">{activeReport.generated_at?.slice(0, 16)}</span>
                  </div>
                </div>

                {/* Section: Key Highlights */}
                <div className="mb-4">
                  <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-cyan-500 inline-block" />
                    Key Highlights (3-5 items)
                  </div>
                  <div className="space-y-1.5">
                    {activeReport.highlights?.map((h: string, i: number) => {
                      const tag = h.match(/^\[(\w+)\s*\w*\]/)?.[1] || "";
                      const tagColor: Record<string, string> = { STATUS: "bg-blue-900/50 text-blue-300", ROOT: "bg-purple-900/50 text-purple-300", ACTION: "bg-emerald-900/50 text-emerald-300", REFERENCE: "bg-yellow-900/50 text-yellow-300", NEXT: "bg-gray-800 text-gray-400" };
                      return (
                        <div key={i} className="flex items-start gap-2 bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-800">
                          {tag && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${tagColor[tag] || "bg-gray-800 text-gray-400"}`}>{tag}</span>}
                          <span className="text-gray-300 text-xs leading-relaxed">{h.replace(/^\[\w+\s*\w*\]\s*/, "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Executive Summary */}
                <div className="mb-4">
                  <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                    Executive Summary
                  </div>
                  <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-gray-800 text-xs text-gray-400 leading-relaxed">
                    {activeReport.content?.split("\n").filter((l: string) => l.trim()).slice(0, 8).join("\n") || "—"}
                  </div>
                </div>

                {/* Section: Raw Report */}
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-gray-600 inline-block" />
                    Full Report Text
                  </div>
                  <pre className="bg-gray-950 rounded-lg p-4 text-[10px] text-gray-400 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono border border-gray-800">
                    {activeReport.content}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Version diff / previous version */}
        {showCompare && prevReport && (
          <div className="col-span-5 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 px-5 py-3 border-b border-gray-800">
              <span className="text-purple-400 font-bold text-sm">Previous Version v{prevReport.ticket_version}</span>
              <span className="text-gray-500 text-xs ml-2">— compare changes</span>
            </div>
            <div className="p-5 space-y-3">
              {/* Highlights diff */}
              <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">Highlights Changed</div>
              {prevReport.highlights?.map((h: string, i: number) => {
                const changed = !activeReport.highlights?.includes(h);
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${changed ? "bg-red-950/20 border-red-900/30 text-red-400/70 line-through" : "bg-gray-800/30 border-gray-800 text-gray-500"}`}>
                    <span className="text-gray-600 text-[10px] shrink-0">{changed ? "✕" : "—"}</span>
                    <span>{h}</span>
                  </div>
                );
              })}
              {/* New highlights added */}
              {activeReport.highlights?.filter((h: string) => !prevReport.highlights?.includes(h)).map((h: string, i: number) => (
                <div key={`new-${i}`} className="flex items-start gap-2 bg-emerald-950/20 rounded-lg px-3 py-2 border border-emerald-900/30 text-xs">
                  <span className="text-emerald-400 text-[10px] shrink-0">+</span>
                  <span className="text-emerald-300">{h}</span>
                </div>
              ))}

              {/* Reports count */}
              <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold mt-4">Reports Generated</div>
              <div className="text-xs text-gray-400">
                {reports.length} versions total — each ticket update triggers a new report.
                The highlights evolve from STATUS+NEXT (v1) → STATUS+ROOT_CAUSE+REFERENCE+NEXT (v2+) → STATUS+ROOT_CAUSE+ACTION+REFERENCE (resolved).
              </div>

              {/* Key insight */}
              <div className="bg-purple-950/20 border border-purple-900/30 rounded-lg p-3 mt-2">
                <div className="text-[10px] text-purple-400 font-bold mb-1">Key Insight</div>
                <div className="text-[10px] text-gray-400 leading-relaxed">
                  The report template is <span className="text-purple-300">fixed (6 sections)</span>: Executive Summary, Current Status, Impact Assessment, Investigation Progress, Key Highlights, Next Steps.
                  But the <span className="text-purple-300">content evolves</span> with each ticket update as more information (root cause, resolution, similar tickets) becomes available.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
