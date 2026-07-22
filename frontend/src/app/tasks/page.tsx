"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

interface Task { id: string; task_order: number; description: string; source: string; status: string; revised_by: string | null; revision_note: string | null; }
interface HistoryEntry { time: string; action: string; by: string; detail: string; }

export default function TaskBoardPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterText, setFilterText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  useEffect(() => { fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents); }, []);

  const filteredIncidents = incidents.filter((t: any) =>
    filterText ? `${t.incident_no} ${t.title}`.toLowerCase().includes(filterText.toLowerCase()) : true
  );

  const loadTasks = async (no: string) => {
    setSelected(no); setSelectedIds(new Set()); setHistory([]);
    try {
      const res = await fetch(`${API}/api/tasks/${no}`).then((r) => r.json());
      setTasks(Array.isArray(res) ? res : []);
    } catch { setTasks([]); }
  };

  const addHistory = (action: string, detail: string, by: string = "demo-user") => {
    setHistory((h) => [{ time: new Date().toISOString().slice(11, 19), action, by, detail }, ...h].slice(0, 20));
  };

  const reviseTask = async (id: string, changes: Record<string, string>) => {
    changes.revised_by = changes.revised_by || "demo-user";
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
    });
    await loadTasks(selected);
  };

  const toggleSelect = (id: string) => { setSelectedIds((s) => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; }); };
  const selectAll = () => { if (selectedIds.size === tasks.length) setSelectedIds(new Set()); else setSelectedIds(new Set(tasks.map((t) => t.id))); };

  const bulkAction = async (status: string) => {
    for (const id of selectedIds) {
      const t = tasks.find((x) => x.id === id);
      if (!t) continue;
      let note = status === "completed" ? prompt(`Result for T${t.task_order}:`) || "Done" : status === "rejected" ? prompt(`Reason for T${t.task_order}:`) || "N/A" : "";
      await reviseTask(id, { status, revision_note: note, revised_by: assignTo || "demo-user" });
      addHistory(status, `T${t.task_order}: ${t.description.slice(0, 60)}`, assignTo || "demo-user");
    }
    setSelectedIds(new Set());
  };

  const filtered = filterStatus ? tasks.filter((t) => t.status === filterStatus) : tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const ICON: Record<string, string> = { pending: "○", in_progress: "◐", completed: "●", rejected: "✕" };
  const SCOLOR: Record<string, string> = { pending: "text-gray-400", in_progress: "text-amber-500", completed: "text-emerald-500", rejected: "text-red-400" };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Task Board</h1>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: Incident selector */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Incidents</span>
          </div>
          <div className="p-2">
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
            {filteredIncidents.map((t: any) => (
              <button key={t.incident_no} onClick={() => loadTasks(t.incident_no)}
                className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${selected === t.incident_no ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-gray-50 border-l-2 border-transparent"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${t.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{t.status}</span>
                </div>
                <div className="text-gray-600 text-[10px] truncate">{t.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Tasks */}
        <div className="col-span-9">
          {!selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-4xl mb-3">☰</div>
              <p className="text-gray-500 text-sm">Select an incident to view its tasks</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-gray-500 text-sm">No tasks for {selected}</p>
              <p className="text-gray-400 text-xs">Update the incident or run lifecycle to generate tasks</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-[10px] text-gray-500 hover:text-gray-700">{selectedIds.size === tasks.length ? "Deselect All" : "Select All"}</button>
                    <span className="text-[10px] text-gray-400">{selectedIds.size} selected</span>
                    <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                      placeholder="Assign to..."
                      className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-600 w-32 focus:outline-none focus:border-indigo-300" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setShowHistory(!showHistory); setHistory([]); }} className="text-[10px] text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1">{showHistory ? "Hide History" : "Revision History"}</button>
                    <button onClick={() => bulkAction("in_progress")} disabled={selectedIds.size === 0} className="text-[10px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white rounded px-2.5 py-1 font-medium">Accept</button>
                    <button onClick={() => bulkAction("completed")} disabled={selectedIds.size === 0} className="text-[10px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white rounded px-2.5 py-1 font-medium">Complete</button>
                    <button onClick={() => bulkAction("rejected")} disabled={selectedIds.size === 0} className="text-[10px] bg-white border border-gray-200 hover:border-red-300 disabled:opacity-30 text-gray-600 rounded px-2.5 py-1">Reject</button>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex gap-3 text-[10px]">
                    {["pending","in_progress","completed","rejected"].map((s) => {
                      const c = tasks.filter((t) => t.status === s).length;
                      if (c === 0) return null;
                      return <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)} className={`${filterStatus===s?"font-bold underline":""} ${SCOLOR[s]}`}>{ICON[s]} {s} ({c})</button>;
                    })}
                  </div>
                  <span className="text-[10px] text-gray-400">{completed}/{tasks.length} ({pct}%)</span>
                </div>
              </div>

              {/* Revision History */}
              {showHistory && history.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3 max-h-40 overflow-y-auto">
                  <h3 className="text-[10px] text-gray-400 uppercase font-bold mb-2">Recent Changes</h3>
                  {history.map((h, i) => (
                    <div key={i} className="text-[9px] text-gray-600 flex gap-2 py-0.5 border-b border-gray-50 last:border-0">
                      <span className="text-gray-400 font-mono">{h.time}</span>
                      <span className={`font-bold ${h.action==="completed"?"text-emerald-500":h.action==="rejected"?"text-red-500":"text-indigo-500"}`}>{h.action}</span>
                      <span className="text-gray-500">{h.by}</span>
                      <span className="truncate">{h.detail}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Task cards */}
              <div className="space-y-2">
                {filtered.map((t) => (
                  <div key={t.id} className={`bg-white border rounded-xl p-3 transition-all flex items-start gap-3 ${selectedIds.has(t.id) ? "border-indigo-300 bg-indigo-50/30" : t.status === "completed" ? "border-emerald-200 bg-emerald-50/30" : t.status === "rejected" ? "border-red-200 bg-red-50/30 line-through" : "border-gray-200 hover:border-gray-300"}`}>
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)}
                      className="mt-1.5 w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    <span className={`text-lg mt-0.5 ${SCOLOR[t.status]}`}>{ICON[t.status]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-indigo-600 text-xs font-bold font-mono">T{t.task_order.toString().padStart(2, "0")}</span>
                        {editingId === t.id ? (
                          <div className="flex-1 flex gap-2">
                            <input value={editText} onChange={(e) => setEditText(e.target.value)}
                              className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
                            <button onClick={() => { reviseTask(t.id, { description: editText }); setEditingId(null); addHistory("modified", `T${t.task_order} description updated`); }} className="text-xs text-indigo-600 font-medium">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                          </div>
                        ) : (
                          <span className="text-gray-700 text-xs">{t.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[9px] text-gray-400">
                        <span>src: {t.source}</span>
                        {t.revised_by && <span>· assigned: {t.revised_by}</span>}
                        {t.revision_note && <span className="text-gray-500">· {t.revision_note}</span>}
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        {!editingId && <button onClick={() => { setEditingId(t.id); setEditText(t.description); }} className="text-[9px] text-gray-400 hover:text-gray-600">✎ Edit</button>}
                        {t.status === "pending" && <button onClick={() => { reviseTask(t.id, { status: "in_progress", revised_by: assignTo || "demo-user" }); addHistory("accepted", `T${t.task_order}`, assignTo || "demo-user"); }} className="text-[9px] text-indigo-500 hover:text-indigo-600 ml-2">Accept</button>}
                        {t.status === "in_progress" && <button onClick={() => { const r = prompt("Result:"); if (r) { reviseTask(t.id, { status: "completed", revision_note: r, revised_by: assignTo || "demo-user" }); addHistory("completed", `T${t.task_order}: ${r}`, assignTo || "demo-user"); } }} className="text-[9px] text-emerald-500 hover:text-emerald-600 ml-2">Complete</button>}
                        {(t.status === "pending" || t.status === "in_progress") && <button onClick={() => { const r = prompt("Rejection reason:"); if (r) { reviseTask(t.id, { status: "rejected", revision_note: r, revised_by: assignTo || "demo-user" }); addHistory("rejected", `T${t.task_order}: ${r}`, assignTo || "demo-user"); } }} className="text-[9px] text-red-400 hover:text-red-500 ml-2">Reject</button>}
                      </div>
                    </div>
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
