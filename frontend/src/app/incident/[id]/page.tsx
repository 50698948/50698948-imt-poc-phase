"use client"; import { useState, useEffect } from "react"; import { useParams } from "next/navigation"; import Link from "next/link";
const API = "http://localhost:8000";
export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  useEffect(() => { const load = async () => { try { const [tR, tlR] = await Promise.all([fetch(`${API}/api/tickets/${id}`), fetch(`${API}/api/incidents/${id}/timeline`)]); setTicket(await tR.json()); setTimeline(await tlR.json()); } catch(e){} }; if(id) load(); }, [id]);
  if (!timeline) return <p className="text-gray-500 text-sm p-6">Loading...</p>;
  const created = timeline.events?.filter((e:any)=>e.type==="created")[0];
  const reports = timeline.events?.filter((e:any)=>e.type==="report");
  const tasks = timeline.events?.filter((e:any)=>e.type==="tasks");
  return (<div className="animate-fade-in">
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6"><Link href="/" className="text-gray-400 hover:text-gray-600 text-xs mb-2 inline-block">← Back to Board</Link>
      <div className="flex items-center justify-between"><div><div className="flex items-center gap-3 mb-1"><span className="text-indigo-600 font-bold text-lg">{timeline.incident_no}</span><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${timeline.status==="resolved"?"status-resolved":"status-investigating"}`}>{timeline.status}</span><span className="text-gray-400 text-xs">v{timeline.version}</span></div><h1 className="text-gray-800 text-sm font-medium">{timeline.title}</h1></div></div></div>

    {/* Horizontal Timeline */}
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h3 className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-4">Event Timeline</h3>
      <div className="relative">
        <div className="absolute top-8 left-0 right-0 h-1 bg-gray-100 rounded-full" />
        <div className="flex justify-between relative mb-6">
          {(created||reports||tasks) && Array.from({length:timeline.events?.length||0}).map((_,i)=>(
            <div key={i} className="relative flex flex-col items-center" style={{width:`${100/Math.max((timeline.events?.length||1),1)}%`}}>
              <div className={`w-3 h-3 rounded-full border-2 border-white z-10 ${timeline.events[i]?.type==="created"?"bg-emerald-400":timeline.events[i]?.type==="report"?"bg-indigo-400":"bg-amber-400"} cursor-pointer hover:scale-125 transition-transform`}
                onClick={()=>setSelectedEvent(selectedEvent===i?null:i)}/>
              <div className="mt-2 text-center"><div className="text-[9px] text-gray-500">{timeline.events[i]?.time?.slice(11,16)||" "}</div><div className="text-[9px] text-gray-400 mt-0.5">{timeline.events[i]?.title?.slice(0,12)}</div></div>
            </div>
          ))}
        </div>
        {selectedEvent !== null && timeline.events[selectedEvent] && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 animate-fade-in">
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-gray-700">{timeline.events[selectedEvent].title}</span><button onClick={()=>setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button></div>
            <p className="text-[10px] text-gray-500">{timeline.events[selectedEvent].detail}</p>
            <p className="text-[9px] text-gray-400 mt-1">{timeline.events[selectedEvent].time}</p>
          </div>
        )}
      </div>
    </div>

    {/* Ticket detail */}
    {ticket && (<div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Description</h3><p className="text-gray-600 text-xs whitespace-pre-wrap">{ticket.description}</p></div>
      {ticket.root_cause && <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Root Cause</h3><p className="text-gray-600 text-xs whitespace-pre-wrap">{ticket.root_cause}</p></div>}
      {ticket.resolution && <div><h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Resolution</h3><p className="text-gray-600 text-xs whitespace-pre-wrap">{ticket.resolution}</p></div>}
    </div>)}
  </div>);
}
