"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API = "http://localhost:8000";

interface Ticket {
  id: string; incident_no: string; title: string; severity: string;
  service_name: string; category: string; status: string;
  error_type: string | null; version: number;
}

const COLUMNS = [
  { key: "open", label: "Open", color: "border-t-red-400", bg: "bg-red-50/50", icon: "○" },
  { key: "investigating", label: "Investigating", color: "border-t-amber-400", bg: "bg-amber-50/50", icon: "◐" },
  { key: "mitigated", label: "Mitigated", color: "border-t-blue-400", bg: "bg-blue-50/50", icon: "◑" },
  { key: "resolved", label: "Resolved", color: "border-t-emerald-400", bg: "bg-emerald-50/50", icon: "●" },
];

const SEV_CLASS: Record<string, string> = { P0: "sev-P0", P1: "sev-P1", P2: "sev-P2", P3: "sev-P3" };

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const load = async (seedFirst = false) => {
    setLoading(true);
    try {
      if (seedFirst) { await fetch(`${API}/api/seed`, { method: "POST" }); }
      const params = new URLSearchParams();
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterService) params.set("service", filterService);
      if (filterCategory) params.set("category", filterCategory);
      const data = await fetch(`${API}/api/tickets?limit=50&${params}`).then((r) => r.json());
      setTickets(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(true); }, []);

  const ticketsByStatus = (status: string) => tickets.filter((t) => t.status === status);

  return (
    <div className="animate-fade-in h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Incident Board</h1>
          <p className="text-gray-500 text-xs mt-1">{tickets.length} tickets across {COLUMNS.length} status columns</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-brand flex items-center gap-1"><span>+</span> New Incident</button>
          <button onClick={() => load(true)} className="btn-secondary flex items-center gap-1"><span>⟳</span> Re-Seed</button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 shrink-0">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Filter:</span>
        <select value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); load(false); }}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:border-indigo-300">
          <option value="">All Severities</option><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); load(false); }}
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-[11px] text-gray-600 cursor-pointer hover:border-gray-300 focus:outline-none focus:border-indigo-300">
          <option value="">All Categories</option><option value="database">Database</option><option value="application">Application</option><option value="network">Network</option><option value="infrastructure">Infrastructure</option><option value="security">Security</option>
        </select>
        {(filterSeverity || filterCategory) && (
          <button onClick={() => { setFilterSeverity(""); setFilterCategory(""); load(false); }}
            className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-lg px-2 py-1 transition-colors">Clear ✕</button>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{tickets.length} shown</span>
      </div>

      {loading ? (
        <div className="flex-1 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="animate-shimmer h-6 w-24 rounded mb-3" />
              {Array.from({ length: 4 }).map((_, j) => (<div key={j} className="animate-shimmer h-20 rounded-lg mb-2" />))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-3 overflow-hidden">
          {COLUMNS.map((col) => {
            const items = ticketsByStatus(col.key);
            return (
              <div key={col.key} className={`${col.bg} border border-gray-200 rounded-xl flex flex-col overflow-hidden`}>
                <div className={`border-t-2 ${col.color} bg-white px-3 py-2.5 shrink-0`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{col.icon}</span>
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{col.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-[10px]"><div className="text-lg mb-1">{col.icon}</div>No {col.label.toLowerCase()} tickets</div>
                  ) : (items.map((t) => (
                    <Link key={t.id} href={`/incident/${t.incident_no}`}
                      className="block bg-white border border-gray-100 hover:border-gray-300 rounded-lg p-3 transition-all duration-150 hover:shadow-sm group cursor-pointer">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-indigo-600 text-[10px] font-bold font-mono group-hover:text-indigo-500">{t.incident_no}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SEV_CLASS[t.severity] || ""}`}>{t.severity}</span>
                      </div>
                      <p className="text-gray-700 text-[11px] leading-snug line-clamp-2 mb-2">{t.title}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-gray-400 flex-wrap">
                        <span>{t.category}</span><span className="text-gray-300">·</span><span>{t.service_name}</span>
                        {t.error_type && <><span className="text-gray-300">·</span><span className="bg-gray-50 px-1 py-0.5 rounded text-gray-500">{t.error_type}</span></>}
                        <span className="text-gray-300 ml-auto">v{t.version}</span>
                      </div>
                    </Link>
                  )))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
