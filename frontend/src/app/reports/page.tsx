"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

export default function ReportsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [reports, setReports] = useState<any[]>([]);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    fetch(`${API}/api/tickets?limit=50`)
      .then((r) => r.json())
      .then(setIncidents);
  }, []);

  useEffect(() => {
    if (!selected) return;
    setReports([]); setContent("");
    fetch(`${API}/api/reports/${selected}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReports(data);
          if (data.length > 0) setContent(data[data.length - 1].content);
        }
      });
  }, [selected]);

  return (
    <div>
      <h1 className="text-xl text-cyan-400 font-bold mb-6">Report Demo</h1>

      <div className="grid grid-cols-3 gap-4">
        {/* Incident List */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Incidents with Reports</div>
          <div className="space-y-1 max-h-[70vh] overflow-y-auto">
            {incidents.map((t: any) => (
              <button key={t.incident_no} onClick={() => setSelected(t.incident_no)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${selected === t.incident_no ? "bg-cyan-900/50 text-cyan-300 border border-cyan-800" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}>
                <div className="font-bold">{t.incident_no}</div>
                <div className="text-[10px] truncate">{t.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Report History */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            {selected ? `Report History — ${selected}` : "Select an incident"}
          </div>
          {reports.length === 0 && selected && (
            <p className="text-gray-600 text-xs">No reports yet. Run the lifecycle demo first.</p>
          )}
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {reports.map((r, i) => (
              <button key={i} onClick={() => setContent(r.content)}
                className={`w-full text-left p-2 rounded border text-xs ${content === r.content ? "border-cyan-700 bg-gray-800" : "border-gray-800 hover:border-gray-700"}`}>
                <span className="text-cyan-400 font-bold">v{r.ticket_version}</span>
                <span className="text-gray-500 ml-2">{r.generated_at?.slice(0, 16)}</span>
                <div className="mt-1 space-y-0.5">
                  {r.highlights?.map((h: string, j: number) => (
                    <div key={j} className="text-[10px] text-gray-500">* {h.slice(0, 80)}</div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Full Report Content */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Full Report</div>
          {content ? (
            <pre className="text-[10px] text-gray-400 whitespace-pre-wrap leading-relaxed max-h-[70vh] overflow-y-auto font-mono">
              {content}
            </pre>
          ) : (
            <p className="text-gray-600 text-xs">Select a report version to view full content.</p>
          )}
        </div>
      </div>
    </div>
  );
}
