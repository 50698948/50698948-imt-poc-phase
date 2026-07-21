"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const API = "http://localhost:8000";

interface Ticket {
  id: string; incident_no: string; title: string; severity: string;
  service_name: string; category: string; status: string;
  error_type: string | null; version: number;
}

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const load = async (seedFirst = false) => {
    setLoading(true);
    try {
      if (seedFirst) { await fetch(`${API}/api/seed`, { method: "POST" }); }
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      const data = await fetch(`${API}/api/tickets?${params}`).then((r) => r.json());
      setTickets(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(true); }, []);

  // Stats
  const stats = { total: tickets.length, open: tickets.filter((t) => t.status === "open").length, investigating: tickets.filter((t) => t.status === "investigating").length, resolved: tickets.filter((t) => t.status === "resolved").length };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Incident Dashboard</h1>
          <p className="text-gray-500 text-xs mt-1">Intelligent ticket retrieval & analysis platform</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center gap-2 bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 shadow-lg shadow-cyan-900/30">
          <span>⟳</span> Re-Seed
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-100", bg: "bg-gray-800/50", border: "border-gray-700" },
          { label: "Open", value: stats.open, color: "text-red-400", bg: "bg-red-950/20", border: "border-red-900/50" },
          { label: "Investigating", value: stats.investigating, color: "text-yellow-400", bg: "bg-yellow-950/20", border: "border-yellow-900/50" },
          { label: "Resolved", value: stats.resolved, color: "text-emerald-400", bg: "bg-emerald-950/20", border: "border-emerald-900/50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 card-hover`}>
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-3xl font-bold ${s.color}`}>{loading ? "—" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">Filter:</span>
        {["", "open", "investigating", "mitigated", "resolved"].map((s) => (
          <button key={s || "all"} onClick={() => { setFilterStatus(s); load(false); }}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${filterStatus === s ? "bg-cyan-900/50 text-cyan-300 border border-cyan-700" : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"}`}>
            {s || "All"}
          </button>
        ))}
        <span className="mx-2 text-gray-700">|</span>
        {["", "database", "application", "network", "infrastructure", "security"].map((c) => (
          <button key={c || "all-cat"} onClick={() => { setFilterCategory(c); load(false); }}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${filterCategory === c ? "bg-purple-900/50 text-purple-300 border border-purple-700" : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"}`}>
            {c || "All Categories"}
          </button>
        ))}
      </div>

      {/* Ticket Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-shimmer h-24 rounded-xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 text-sm">No tickets match the selected filters</p>
          <button onClick={() => { setFilterStatus(""); setFilterCategory(""); load(false); }} className="text-cyan-500 text-xs mt-2 hover:text-cyan-400">Clear filters →</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tickets.map((t, i) => (
            <Link key={t.id} href={`/incident/${t.incident_no}`}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 card-hover animate-fade-in block"
              style={{ animationDelay: `${i * 30}ms` }}>
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <span className="text-cyan-400 text-xs font-bold font-mono">{t.incident_no}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium sev-${t.severity}`}>{t.severity}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium status-${t.status}`}>{t.status}</span>
                </div>
              </div>
              {/* Title */}
              <p className="text-gray-200 text-xs font-medium mb-2 line-clamp-2 leading-relaxed">{t.title}</p>
              {/* Meta */}
              <div className="flex items-center gap-2 text-[10px] text-gray-600">
                <span className="text-gray-500">{t.category}</span>
                <span className="text-gray-700">·</span>
                <span>{t.service_name}</span>
                {t.error_type && <><span className="text-gray-700">·</span><span className="text-gray-500">{t.error_type}</span></>}
                <span className="text-gray-700">·</span>
                <span>v{t.version}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
