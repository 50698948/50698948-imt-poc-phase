"use client"; import { useState, useEffect } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
const API = "http://localhost:8000";

function TimelineEvent({ event, index, total, isSelected, onClick }: { event: any; index: number; total: number; isSelected: boolean; onClick: () => void }) {
  const colors: Record<string, { dot: string; line: string; bg: string; icon: string }> = {
    created: { dot: "bg-emerald-500", line: "border-emerald-200", bg: "bg-emerald-50 border-emerald-200", icon: "●" },
    report: { dot: "bg-indigo-500", line: "border-indigo-200", bg: "bg-indigo-50 border-indigo-200", icon: "📄" },
    tasks: { dot: "bg-amber-500", line: "border-amber-200", bg: "bg-amber-50 border-amber-200", icon: "📋" },
  };
  const c = colors[event.type] || { dot: "bg-gray-400", line: "border-gray-200", bg: "bg-gray-50 border-gray-200", icon: "•" };
  const time = event.time?.slice(11, 16) || "";
  const date = event.time?.slice(0, 10) || "";

  return (
    <div className="flex flex-col items-center" style={{ width: `${100 / Math.max(total, 1)}%`, minWidth: 80 }}>
      {/* Dot + connector */}
      <div className="relative w-full flex items-center justify-center h-10">
        <div className={`absolute left-0 right-1/2 h-0.5 ${c.line} border-t-2`} style={{ display: index === 0 ? "none" : "block" }} />
        <div className={`absolute left-1/2 right-0 h-0.5 ${c.line} border-t-2`} style={{ display: index === total - 1 ? "none" : "block" }} />
        <button onClick={onClick} className={`relative z-10 w-8 h-8 rounded-full ${c.dot} flex items-center justify-center text-white text-sm font-bold shadow-sm hover:scale-110 transition-transform ${isSelected ? "ring-4 ring-offset-2 ring-gray-200" : ""}`}>
          {c.icon}
        </button>
      </div>
      {/* Label */}
      <div className="text-center mt-2">
        <div className="text-[10px] font-bold text-gray-700">{event.title?.split(" ")[0]}</div>
        <div className="text-[9px] text-gray-400">{time}</div>
        <div className="text-[8px] text-gray-300">{date}</div>
      </div>
      {/* Expanded detail */}
      {isSelected && (
        <div className={`mt-3 ${c.bg} rounded-lg p-3 border text-left animate-fade-in absolute top-full z-20 shadow-lg`} style={{ width: 240, left: "50%", transform: "translateX(-50%)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-700">{event.title}</span>
            <button onClick={onClick} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <p className="text-[9px] text-gray-500 leading-relaxed">{event.detail}</p>
          <p className="text-[8px] text-gray-400 mt-1">{event.time}</p>
        </div>
      )}
    </div>
  );
}

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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
  const created = events.find((e: any) => e.type === "created");

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-xs mb-3 inline-block">← Back to Board</Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-indigo-600 font-bold text-lg font-mono">{timeline.incident_no}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${timeline.status === "resolved" ? "status-resolved" : "status-investigating"}`}>
                {timeline.status}
              </span>
              <span className="text-gray-400 text-xs font-mono">v{timeline.version}</span>
            </div>
            <h1 className="text-gray-800 text-sm font-medium leading-relaxed">{timeline.title}</h1>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-400">Created</div>
            <div className="text-xs text-gray-600 font-mono">{created?.time?.slice(0, 16) || "—"}</div>
          </div>
        </div>
      </div>

      {/* Horizontal Timeline */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-6">Event Timeline</h3>

        {/* Time axis */}
        <div className="relative pb-4">
          <div className="flex justify-between items-start">
            {events.map((e: any, i: number) => (
              <TimelineEvent key={i} event={e} index={i} total={events.length} isSelected={selectedIdx === i} onClick={() => setSelectedIdx(selectedIdx === i ? null : i)} />
            ))}
          </div>
        </div>
      </div>

      {/* Event Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {events.filter((e: any) => e.type === "report" || e.type === "tasks").slice(0, 3).map((e: any, i: number) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition-colors">
            <div className="text-[10px] text-gray-400 font-bold mb-1">{e.type === "report" ? "📄 Report" : "📋 Tasks"}</div>
            <div className="text-[10px] text-gray-600 leading-relaxed">{e.detail?.slice(0, 100)}</div>
            <div className="text-[8px] text-gray-400 mt-1">{e.time?.slice(0, 16)}</div>
          </div>
        ))}
      </div>

      {/* Full Details */}
      {ticket && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Description</h3><p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap">{ticket.description}</p></div>
          {ticket.root_cause && <div className="border-t border-gray-100 pt-4"><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Root Cause</h3><div className="bg-red-50 border border-red-100 rounded-lg p-3"><p className="text-gray-600 text-xs leading-relaxed">{ticket.root_cause}</p></div></div>}
          {ticket.resolution && <div className="border-t border-gray-100 pt-4"><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Resolution</h3><div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3"><p className="text-gray-600 text-xs leading-relaxed">{ticket.resolution}</p></div></div>}
        </div>
      )}
    </div>
  );
}
