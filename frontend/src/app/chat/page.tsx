"use client";

import { useState, useRef, useEffect } from "react";

const API = "http://localhost:8000";

interface Msg { role: "user" | "system"; text: string }

const QUICK_ACTIONS = [
  "update status to investigating",
  "update status to resolved",
  "root cause: connection pool exhausted due to N+1 queries",
  "resolution: rolled back deployment, increased pool size",
  "recommendations",
  "latest report",
];

export default function ChatPage() {
  const [incidentNo, setIncidentNo] = useState("INC-2025-0001");
  const [messages, setMessages] = useState<Msg[]>([{ role: "system", text: "Welcome! I can help you manage incidents. Select an incident and try a command." }]);
  const [input, setInput] = useState("");
  const [ticket, setTicket] = useState<any>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const loadTicket = async (no: string) => {
    try {
      const res = await fetch(`${API}/api/tickets/${no}`);
      setTicket(await res.json());
    } catch { setTicket(null); }
  };

  useEffect(() => { loadTicket(incidentNo); }, [incidentNo]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, incident_no: incidentNo }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "system", text: data.reply }]);
      loadTicket(incidentNo);
    } catch {
      setMessages((m) => [...m, { role: "system", text: "Error connecting to backend." }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
          <span className="text-cyan-400 font-bold text-sm">Chat</span>
          <input value={incidentNo} onChange={(e) => setIncidentNo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300 w-44 font-mono" />
          <span className="text-gray-600 text-xs">type an incident number</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.role === "user" ? "bg-cyan-800 text-white" : "bg-gray-800 text-gray-300"}`}>
                <pre className="whitespace-pre-wrap font-mono text-xs">{m.text}</pre>
              </div>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>

        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {QUICK_ACTIONS.map((a) => (
            <button key={a} onClick={() => send(a)} className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded px-2 py-0.5 text-[10px] transition-colors">
              {a}
            </button>
          ))}
        </div>

        <div className="flex border-t border-gray-800 p-2 gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-300"
            placeholder="Type a command..." />
          <button onClick={() => send(input)} className="bg-cyan-700 hover:bg-cyan-600 text-white rounded px-4 py-1.5 text-xs font-bold uppercase">Send</button>
        </div>
      </div>

      {/* Sidebar */}
      {ticket && (
        <div className="w-72 bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-y-auto">
          <div className="text-xs text-cyan-400 font-bold mb-2">{ticket.incident_no}</div>
          <div className="text-sm text-gray-200 mb-1">{ticket.title}</div>
          <div className="text-xs text-gray-500 mb-3">{ticket.service_name} / {ticket.category}</div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="text-gray-500">Status</span><span className="text-yellow-400 uppercase">{ticket.status}</span>
            <span className="text-gray-500">Severity</span><span className="text-red-400">{ticket.severity}</span>
            <span className="text-gray-500">Version</span><span className="text-gray-300">v{ticket.version}</span>
            <span className="text-gray-500">Error</span><span className="text-gray-400">{ticket.error_type || "N/A"}</span>
          </div>
          <div className="border-t border-gray-800 mt-3 pt-2">
            <a href={`/incident/${ticket.incident_no}`} className="text-cyan-500 hover:text-cyan-400 text-[10px]">View Timeline →</a>
          </div>
        </div>
      )}
    </div>
  );
}
