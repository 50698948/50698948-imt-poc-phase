"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

interface Ticket {
  id: string;
  incident_no: string;
  title: string;
  severity: string;
  service_name: string;
  category: string;
  status: string;
  error_type: string | null;
  version: number;
}

const STATUS_COLOR: Record<string, string> = {
  open: "text-red-400",
  investigating: "text-yellow-400",
  mitigated: "text-blue-400",
  resolved: "text-green-400",
};

const SEVERITY_COLOR: Record<string, string> = {
  P0: "bg-red-900/50 text-red-300 border-red-700",
  P1: "bg-orange-900/50 text-orange-300 border-orange-700",
  P2: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  P3: "bg-gray-800 text-gray-400 border-gray-700",
};

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const load = async (seedFirst = false) => {
    setLoading(true);
    try {
      if (seedFirst) {
        await fetch(`${API}/api/seed`, { method: "POST" });
      }
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      const res = await fetch(`${API}/api/tickets?${params}`);
      const data = await res.json();
      setTickets(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(true); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl text-cyan-400 font-bold">Incident Tickets</h1>
          <p className="text-gray-500 text-xs mt-1">{tickets.length} tickets loaded</p>
        </div>
        <div className="flex gap-2">
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); load(false); }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="mitigated">Mitigated</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); load(false); }}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
            <option value="">All Category</option>
            <option value="database">Database</option>
            <option value="application">Application</option>
            <option value="network">Network</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="security">Security</option>
          </select>
          <button onClick={() => load(true)} className="bg-cyan-700 hover:bg-cyan-600 text-white rounded px-3 py-1 text-xs font-bold uppercase">
            Re-Seed
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid gap-2">
          {tickets.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cyan-400 text-xs font-bold">{t.incident_no}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLOR[t.severity] || "border-gray-700"}`}>
                      {t.severity}
                    </span>
                    <span className={`text-[10px] ${STATUS_COLOR[t.status] || "text-gray-400"}`}>
                      {t.status}
                    </span>
                    <span className="text-gray-600 text-[10px]">v{t.version}</span>
                  </div>
                  <p className="text-gray-300 text-xs truncate">{t.title}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-gray-500 text-[10px]">{t.category}</div>
                  <div className="text-gray-600 text-[10px]">{t.service_name}</div>
                  {t.error_type && <div className="text-gray-600 text-[10px]">{t.error_type}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
