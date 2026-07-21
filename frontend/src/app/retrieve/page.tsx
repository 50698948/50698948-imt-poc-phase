"use client";

import { useState } from "react";

const API = "http://localhost:8000";

const DEFAULT = {
  title: "Order service P99 latency spike after MySQL migration",
  description: "After migrating order-service DB from MySQL 5.7 to 8.0, P99 latency spiked from 120ms to 2.8s. Slow query log shows 200+ SELECT queries scanning 6M rows. Connection pool showing intermittent errors. MySQL CPU steady at 85%.",
  service_name: "order-service",
  category: "database",
  severity: "P1",
  error_type: "timeout",
};

export default function RetrievePage() {
  const [form, setForm] = useState(DEFAULT);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const res = await fetch(`${API}/api/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setResult(await res.json());
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-xl text-cyan-400 font-bold mb-6">E2E Retrieval Pipeline</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Current Incident</div>
          {(["title", "description", "service_name", "category", "severity", "error_type"] as const).map((f) => (
            <div key={f}>
              <label className="text-[10px] text-gray-500 uppercase">{f}</label>
              {f === "description" ? (
                <textarea value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300 h-24 resize-none" />
              ) : (
                <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-gray-300" />
              )}
            </div>
          ))}
          <button onClick={run} disabled={loading}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-bold uppercase w-full">
            {loading ? "Running..." : "Run Retrieval"}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result && (
            <>
              <div className="text-xs text-gray-400 uppercase tracking-wider">Reranked Top-5</div>
              {result.reranked?.map((r: any, i: number) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cyan-400 text-xs font-bold">{r.incident_no}</span>
                    <span className="text-yellow-400 text-xs">{r.rerank_score?.toFixed(1)}</span>
                  </div>
                  <p className="text-gray-300 text-xs">{r.title}</p>
                  <p className="text-gray-600 text-[10px] mt-1">{r.rerank_reason}</p>
                  {r.root_cause && <p className="text-gray-500 text-[10px] mt-1 truncate">RC: {r.root_cause}</p>}
                </div>
              ))}

              <div className="text-xs text-gray-400 uppercase tracking-wider mt-4">Action Plan</div>
              <pre className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-400 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.action_plan}
              </pre>

              <div className="text-xs text-gray-400 uppercase tracking-wider mt-4">All RRF Candidates ({result.candidates?.length || 0})</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.candidates?.map((c: any, i: number) => (
                  <div key={i} className="text-[10px] text-gray-500 flex gap-2">
                    <span className="text-gray-600 w-6">{i + 1}.</span>
                    <span className="text-cyan-500 w-20">{c.incident_no}</span>
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
