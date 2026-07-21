"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const API = "http://localhost:8000";

const ICONS: Record<string, string> = {
  created: "●",
  report: "📄",
  tasks: "📋",
};

const TYPE_COLOR: Record<string, string> = {
  created: "text-green-400",
  report: "text-cyan-400",
  tasks: "text-yellow-400",
};

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, tlRes] = await Promise.all([
          fetch(`${API}/api/tickets/${id}`),
          fetch(`${API}/api/incidents/${id}/timeline`),
        ]);
        setTicket(await tRes.json());
        setTimeline(await tlRes.json());
      } catch (e) { console.error(e); }
    };
    if (id) load();
  }, [id]);

  if (!timeline) return <p className="text-gray-500 text-sm p-4">Loading...</p>;

  return (
    <div>
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-cyan-400 font-bold text-lg">{timeline.incident_no}</span>
              <span className={`text-xs px-2 py-0.5 rounded uppercase ${timeline.status === "resolved" ? "text-green-400 bg-green-900/30" : "text-yellow-400 bg-yellow-900/30"}`}>{timeline.status}</span>
              <span className="text-gray-600 text-xs">v{timeline.version}</span>
            </div>
            <h1 className="text-gray-200 text-sm">{timeline.title}</h1>
          </div>
          <div className="text-right">
            <a href={`/chat`} className="text-cyan-500 hover:text-cyan-400 text-xs">Open Chat →</a>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-8 border-l-2 border-gray-800 ml-2">
        {timeline.events?.map((e: any, i: number) => (
          <div key={i} className="mb-6 relative">
            <div className={`absolute -left-[29px] w-4 h-4 flex items-center justify-center rounded-full bg-gray-900 border-2 ${e.type === "created" ? "border-green-700" : "border-gray-700"}`}>
              <span className="text-[10px]">{ICONS[e.type] || "•"}</span>
            </div>
            <div className="text-[10px] text-gray-600 mb-0.5">{e.time?.slice(0, 16) || ""}</div>
            <div className={`text-xs font-bold mb-0.5 ${TYPE_COLOR[e.type] || "text-gray-400"}`}>{e.title}</div>
            <div className="text-[11px] text-gray-500">{e.detail}</div>
          </div>
        ))}
      </div>

      {/* Ticket detail */}
      {ticket && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mt-6">
          <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Full Description</h3>
          <p className="text-gray-300 text-xs whitespace-pre-wrap">{ticket.description}</p>
          {ticket.root_cause && (
            <>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mt-4 mb-2">Root Cause</h3>
              <p className="text-gray-300 text-xs whitespace-pre-wrap">{ticket.root_cause}</p>
            </>
          )}
          {ticket.resolution && (
            <>
              <h3 className="text-xs text-gray-400 uppercase tracking-wider mt-4 mb-2">Resolution</h3>
              <p className="text-gray-300 text-xs whitespace-pre-wrap">{ticket.resolution}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
