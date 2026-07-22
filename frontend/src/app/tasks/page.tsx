"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

interface Task { id: string; task_order: number; description: string; source: string; status: string; revised_by: string | null; revision_note: string | null; }
interface HistoryEntry { time: string; action: string; by: string; detail: string; }

export default function TaskBoardPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [searchText, setSearchText] = useState("");

  useEffect(() => { fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents); }, []);

  const loadTasks = async (no: string) => {
    setSelected(no); setSelectedIds(new Set());
    try { const res = await fetch(`${API}/api/tasks/${no}`).then((r) => r.json()); setTasks(Array.isArray(res) ? res : []); } catch { setTasks([]); }
  };

  const loadHistory = async () => {
    if (!selected) return;
    try { const res = await fetch(`${API}/api/tasks/${selected}/history`).then((r) => r.json()); setHistory(res.map((h: any) => ({ time: h.created_at?.slice(11, 19) || "", action: h.action, by: h.revised_by || "", detail: h.detail || "" }))); } catch { setHistory([]); }
  };

  const reviseTask = async (id: string, changes: Record<string, string>) => {
    changes.revised_by = changes.revised_by || "demo-user";
    await fetch(`${API}/api/tasks/${id}/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    await loadTasks(selected);
  };

  const toggleSelect = (id: string) => { setSelectedIds((s) => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; }); };
  const selectAll = () => { if (selectedIds.size === tasks.length) setSelectedIds(new Set()); else setSelectedIds(new Set(tasks.map((t) => t.id))); };

  const bulkAction = async (status: string) => {
    for (const id of selectedIds) {
      const t = tasks.find((x) => x.id === id); if (!t) continue;
      await reviseTask(id, { status, revision_note: status === "completed" ? "Done" : status === "rejected" ? "N/A" : "", revised_by: assignTo || "demo-user" });
    }
    setSelectedIds(new Set()); loadHistory();
  };

  const filtered = filterStatus ? tasks.filter((t) => t.status === filterStatus) : tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const ICON: Record<string, string> = { pending: "○", in_progress: "◐", completed: "●", rejected: "✕" };
  const SCOLOR: Record<string, string> = { pending: "text-gray-400", in_progress: "text-amber-500", completed: "text-emerald-500", rejected: "text-red-400" };

  const filteredIncidents = incidents.filter((t: any) => searchText ? `${t.incident_no} ${t.title}`.toLowerCase().includes(searchText.toLowerCase()) : true);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Task Board</h1>

      {/* ── Incident Selector Bar ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">Incident</span>
          <div className="relative flex-1 max-w-sm">
            <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by incident number or title..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" />
            <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
          </div>
          {selected && (
            <span className="text-xs text-gray-400">
              <span className="text-indigo-600 font-bold font-mono">{selected}</span>
              <span className="mx-2">—</span>
              {tasks.length} tasks
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 max-h-32 overflow-y-auto">
          {filteredIncidents.slice(0, 20).map((t: any) => (
            <button key={t.incident_no} onClick={() => loadTasks(t.incident_no)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${selected === t.incident_no ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"}`}>
              {t.incident_no}
              <span className={`ml-1.5 px-1 py-0.5 rounded text-[8px] ${t.status === "resolved" ? "bg-emerald-100 text-emerald-600" : t.status === "investigating" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500"}`}>{t.status}</span>
            </button>
          ))}
          {filteredIncidents.length > 20 && <span className="text-[10px] text-gray-400 self-center">+{filteredIncidents.length - 20} more</span>}
        </div>
      </div>

      {/* ── Task Board ── */}
      {!selected ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">☰</div>
          <p className="text-gray-500 text-sm mb-1">Select an incident above to view its tasks</p>
          <p className="text-gray-400 text-xs">Tasks are auto-generated when the incident is updated</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-3xl mb-3">📭</div>
          <p className="text-gray-500 text-sm mb-1">No tasks for {selected}</p>
          <p className="text-gray-400 text-xs">Update the incident or run lifecycle demo to generate tasks</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={selectAll} className="text-[10px] text-gray-500 hover:text-gray-700 font-medium">{selectedIds.size === tasks.length ? "Deselect All" : "Select All"}</button>
                <span className="text-[10px] text-gray-400">{selectedIds.size > 0 ? `${selectedIds.size} selected` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                  placeholder="Assign to..."
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-600 w-28 focus:outline-none focus:border-indigo-300" />
                <button onClick={() => { loadHistory(); setShowHistory(!showHistory); }} className={`text-[10px] border rounded-lg px-2.5 py-1.5 font-medium transition-all ${showHistory ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "text-gray-500 border-gray-200 hover:border-gray-300"}`}>{showHistory ? "Hide" : "History"}</button>
                <span className="text-gray-200">|</span>
                <button onClick={() => bulkAction("in_progress")} disabled={selectedIds.size === 0} className="text-[10px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white rounded-lg px-3 py-1.5 font-medium">Accept</button>
                <button onClick={() => bulkAction("completed")} disabled={selectedIds.size === 0} className="text-[10px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white rounded-lg px-3 py-1.5 font-medium">Complete</button>
                <button onClick={() => bulkAction("rejected")} disabled={selectedIds.size === 0} className="text-[10px] bg-white border border-gray-200 hover:border-red-300 disabled:opacity-30 text-gray-600 rounded-lg px-3 py-1.5">Reject</button>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-3 text-[10px]">
                {["pending","in_progress","completed","rejected"].map((s) => {
                  const c = tasks.filter((t) => t.status === s).length;
                  if (c === 0) return null;
                  return <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)} className={`${filterStatus===s?"font-bold underline":""} ${SCOLOR[s]}`}>{ICON[s]} {s} ({c})</button>;
                })}
              </div>
              <span className="text-[10px] text-gray-400">{completed}/{tasks.length} completed ({pct}%)</span>
            </div>
          </div>

          {/* History */}
          {showHistory && history.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 max-h-48 overflow-y-auto">
              <h3 className="text-[10px] text-gray-400 uppercase font-bold mb-2">Revision History</h3>
              {history.map((h, i) => (
                <div key={i} className="text-[9px] flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-400 font-mono w-12">{h.time}</span>
                  <span className={`font-bold w-16 ${h.action==="completed"?"text-emerald-500":h.action==="rejected"?"text-red-500":h.action==="assigned"?"text-indigo-500":"text-gray-500"}`}>{h.action}</span>
                  <span className="text-gray-400 w-20 truncate">{h.by}</span>
                  <span className="text-gray-500 truncate flex-1">{h.detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Task Cards */}
          <div className="space-y-2">
            {filtered.map((t) => (
              <div key={t.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 transition-all ${selectedIds.has(t.id) ? "border-indigo-300 bg-indigo-50/20" : t.status === "completed" ? "border-emerald-200 bg-emerald-50/20" : t.status === "rejected" ? "border-red-200 bg-red-50/20 opacity-70" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)}
                  className="mt-1 w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                <span className={`text-lg mt-0.5 ${SCOLOR[t.status]}`}>{ICON[t.status]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-indigo-600 text-xs font-bold font-mono">T{t.task_order.toString().padStart(2, "0")}</span>
                    {editingId === t.id ? (
                      <div className="flex-1 flex gap-2">
                        <input value={editText} onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
                        <button onClick={() => { reviseTask(t.id, { description: editText }); setEditingId(null); }} className="text-xs text-indigo-600 font-medium">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                      </div>
                    ) : (
                      <span className={`text-gray-700 text-xs ${t.status === "rejected" ? "line-through" : ""}`}>{t.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[9px] text-gray-400">
                    <span>src: {t.source}</span>
                    {t.revised_by && <span className="text-indigo-500 font-medium">· {t.revised_by}</span>}
                    {t.revision_note && <span className="text-gray-500">· {t.revision_note.slice(0, 60)}</span>}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {!editingId && <button onClick={() => { setEditingId(t.id); setEditText(t.description); }} className="text-[9px] text-gray-400 hover:text-gray-600">✎</button>}
                    {assignTo && <button onClick={() => reviseTask(t.id, { revised_by: assignTo })} className="text-[9px] text-gray-400 hover:text-indigo-600 ml-1.5">👤 Assign</button>}
                    {t.status === "pending" && <button onClick={() => reviseTask(t.id, { status: "in_progress", revised_by: assignTo || "demo-user" })} className="text-[9px] text-indigo-500 hover:text-indigo-600 font-medium ml-2">Accept</button>}
                    {t.status === "in_progress" && <button onClick={() => { const r = prompt("Result:"); if (r) reviseTask(t.id, { status: "completed", revision_note: r }); }} className="text-[9px] text-emerald-500 hover:text-emerald-600 font-medium ml-2">Complete</button>}
                    {(t.status === "pending" || t.status === "in_progress") && <button onClick={() => { const r = prompt("Reason:"); if (r) reviseTask(t.id, { status: "rejected", revision_note: r }); }} className="text-[9px] text-red-400 hover:text-red-500 ml-2">Reject</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom */}
          <div className="mt-4">
            {addingNew ? (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <input value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="New task description..." onKeyDown={(e) => { if (e.key === "Enter" && newTaskDesc.trim()) { setAddingNew(false); setNewTaskDesc(""); } }}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => { if (newTaskDesc.trim()) { setAddingNew(false); setNewTaskDesc(""); } }} className="btn-brand text-xs">Add Task</button>
                  <button onClick={() => { setAddingNew(false); setNewTaskDesc(""); }} className="btn-secondary text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingNew(true)} className="btn-secondary text-xs w-full text-center py-3 border-dashed rounded-xl">+ Add Custom Task</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
