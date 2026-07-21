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
  { key: "open", label: "Open", color: "border-t-red-500", bg: "bg-red-950/20", icon: "○", countBg: "bg-red-900/50", countText: "text-red-300" },
  { key: "investigating", label: "Investigating", color: "border-t-yellow-500", bg: "bg-yellow-950/20", icon: "◐", countBg: "bg-yellow-900/50", countText: "text-yellow-300" },
  { key: "mitigated", label: "Mitigated", color: "border-t-blue-500", bg: "bg-blue-950/20", icon: "◑", countBg: "bg-blue-900/50", countText: "text-blue-300" },
  { key: "resolved", label: "Resolved", color: "border-t-emerald-500", bg: "bg-emerald-950/20", icon: "●", countBg: "bg-emerald-900/50", countText: "text-emerald-300" },
];

const SEV_CLASS: Record<string, string> = {
  P0: "bg-red-950/40 text-red-300 border-red-800/50",
  P1: "bg-orange-950/40 text-orange-300 border-orange-800/50",
  P2: "bg-yellow-950/40 text-yellow-300 border-yellow-800/50",
  P3: "bg-gray-800 text-gray-400 border-gray-700",
};

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
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Incident Board</h1>
          <p className="text-gray-500 text-xs mt-1">{tickets.length} tickets across {COLUMNS.length} status columns</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 shadow-lg shadow-cyan-900/30">
          <span>⟳</span> Re-Seed
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <span className="text-[10px] text-gray-600 uppercase tracking-wider">Filter:</span>
        <select value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); load(false); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 cursor-pointer hover:border-gray-600 transition-colors">
          <option value="">All Severities</option>
          <option value="P0">P0 — Critical</option>
          <option value="P1">P1 — High</option>
          <option value="P2">P2 — Medium</option>
          <option value="P3">P3 — Low</option>
        </select>
        <select value={filterService} onChange={(e) => { setFilterService(e.target.value); load(false); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 cursor-pointer hover:border-gray-600 transition-colors">
          <option value="">All Services</option>
          {["order-service","payment-service","api-gateway","auth-service","notification-service","reporting-service","search-service","session-service","product-service","inventory-service","image-service","recommendation-service","social-feed","game-leaderboard","data-platform","data-export-service","infra-network","infra-dns","infra-tf","infra-platform","infra-secrets","k8s-cluster","ecs-cluster","etcd-cluster","istio-mesh","cicd-pipeline","artifact-repo","monitoring","websocket-gateway","storage-s3","ci-build-agents"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); load(false); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-[11px] text-gray-300 cursor-pointer hover:border-gray-600 transition-colors">
          <option value="">All Categories</option>
          <option value="database">Database</option>
          <option value="application">Application</option>
          <option value="network">Network</option>
          <option value="infrastructure">Infrastructure</option>
          <option value="security">Security</option>
        </select>
        {(filterSeverity || filterService || filterCategory) && (
          <button onClick={() => { setFilterSeverity(""); setFilterService(""); setFilterCategory(""); load(false); }}
            className="text-[10px] text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 rounded-lg px-2 py-1 transition-colors">
            Clear ✕
          </button>
        )}
        <span className="text-[10px] text-gray-700 ml-auto">{tickets.length} shown</span>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex-1 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <div className="animate-shimmer h-6 w-24 rounded mb-3" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="animate-shimmer h-20 rounded-lg mb-2" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-4 gap-3 overflow-hidden">
          {COLUMNS.map((col) => {
            const items = ticketsByStatus(col.key);
            return (
              <div key={col.key} className={`${col.bg} border border-gray-800 rounded-xl flex flex-col overflow-hidden`}>
                {/* Column Header */}
                <div className={`border-t-2 ${col.color} px-3 py-2.5 shrink-0`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{col.icon}</span>
                      <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">{col.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.countBg} ${col.countText}`}>
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-[10px]">
                      <div className="text-lg mb-1">{col.icon}</div>
                      No {col.label.toLowerCase()} tickets
                    </div>
                  ) : (
                    items.map((t) => (
                      <Link key={t.id} href={`/incident/${t.incident_no}`}
                        className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 group cursor-pointer">
                        {/* Ticket ID + Severity */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-cyan-400 text-[10px] font-bold font-mono group-hover:text-cyan-300">{t.incident_no}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SEV_CLASS[t.severity] || ""}`}>{t.severity}</span>
                        </div>
                        {/* Title */}
                        <p className="text-gray-300 text-[11px] leading-snug line-clamp-2 mb-2 group-hover:text-gray-200">{t.title}</p>
                        {/* Footer meta */}
                        <div className="flex items-center gap-1.5 text-[9px] text-gray-600 flex-wrap">
                          <span className="text-gray-500">{t.category}</span>
                          <span className="text-gray-700">·</span>
                          <span>{t.service_name}</span>
                          {t.error_type && (
                            <>
                              <span className="text-gray-700">·</span>
                              <span className="bg-gray-800 px-1 py-0.5 rounded text-gray-500">{t.error_type}</span>
                            </>
                          )}
                          <span className="text-gray-700 ml-auto">v{t.version}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
