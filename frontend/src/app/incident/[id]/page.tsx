"use client"; import { useState, useEffect } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
const API = "http://localhost:8000";

const EVENT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  created: { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: "●", label: "Created" },
  report: { color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", icon: "📄", label: "Report" },
  tasks: { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: "📋", label: "Tasks" },
};

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tR, tlR] = await Promise.all([fetch(`${API}/api/tickets/${id}`), fetch(`${API}/api/incidents/${id}/timeline`)]);
        setTicket(await tR.json()); setTimeline(await tlR.json());
      } catch (e) { console.error(e); }
    })();
  }, [id]);

  if (!timeline) return <div className="text-gray-400 text-sm p-8">Loading...</div>;

  const events = [...(timeline.events || [])].sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-xs mb-3 inline-block">← Back to Board</Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-indigo-600 font-bold text-lg font-mono">{timeline.incident_no}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${timeline.status === "resolved" ? "status-resolved" : "status-investigating"}`}>{timeline.status}</span>
              <span className="text-gray-400 text-xs font-mono">v{timeline.version}</span>
            </div>
            <h1 className="text-gray-800 text-sm font-medium leading-relaxed">{timeline.title}</h1>
          </div>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="relative">
        {/* Main timeline line */}
        <div className="absolute left-[19px] top-3 bottom-8 w-0.5 bg-gray-200" />

        <div className="space-y-1">
          {events.map((event: any, i: number) => {
            const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.created;
            const isExpanded = expandedIdx === i;
            const isFirst = i === 0;
            const isLast = i === events.length - 1;
            const timeStr = event.time?.slice(11, 16) || "";
            const dateStr = event.time?.slice(0, 10) || "";

            return (
              <div key={i} className="relative pl-12 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                {/* Timeline dot */}
                <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  className={`absolute left-[11px] top-[18px] w-[18px] h-[18px] rounded-full border-[3px] border-white shadow-sm z-10 flex items-center justify-center transition-all hover:scale-125 cursor-pointer ${cfg.bg} ${cfg.border}`}>
                  <span className="text-[9px]">{cfg.icon}</span>
                </button>

                {/* Time label */}
                <div className="text-[10px] text-gray-400 font-mono mb-1 mt-2">
                  {timeStr}
                  {dateStr !== events[0]?.time?.slice(0, 10) && <span className="text-gray-300 ml-1">{dateStr}</span>}
                </div>

                {/* Event card */}
                <div className="ml-1">
                  <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[10px] text-gray-500">{event.title}</span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className={`mt-3 ${cfg.bg} rounded-lg p-3 border ${cfg.border}`}>
                        <p className="text-[10px] text-gray-600 leading-relaxed whitespace-pre-wrap">{event.detail}</p>
                        {event.type === "report" && event.detail && (
                          <div className="mt-2 space-y-0.5">
                            {event.detail.split("|").map((h: string, j: number) => (
                              <div key={j} className="text-[9px] text-gray-500">• {h.trim()}</div>
                            ))}
                          </div>
                        )}
                        <div className="text-[8px] text-gray-400 mt-2">{event.time}</div>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 mt-6 mb-6">
        {[
          { label: "Events", value: events.length, color: "text-gray-700" },
          { label: "Created", value: events.filter((e: any) => e.type === "created").length, color: "text-emerald-600" },
          { label: "Reports", value: events.filter((e: any) => e.type === "report").length, color: "text-indigo-600" },
          { label: "Tasks", value: events.filter((e: any) => e.type === "tasks").length, color: "text-amber-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Full Details */}
      {ticket && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Description</h3><p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap">{ticket.description}</p></div>
          {ticket.root_cause && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Root Cause</h3>
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-gray-700 text-xs leading-relaxed">{ticket.root_cause}</p>
              </div>
            </div>
          )}
          {ticket.resolution && (
            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Resolution</h3>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                <p className="text-gray-700 text-xs leading-relaxed">{ticket.resolution}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
