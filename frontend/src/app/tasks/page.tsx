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
  const [showAll, setShowAll] = useState(false);

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
    for (const id of selectedIds) { await reviseTask(id, { status, revised_by: assignTo || "demo-user" }); }
    setSelectedIds(new Set()); loadHistory();
  };

  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const ICON: Record<string, string> = { pending: "○", in_progress: "◐", completed: "●", rejected: "✕" };
  const SCOLOR: Record<string, string> = { pending: "text-gray-400", in_progress: "text-amber-500", completed: "text-emerald-500", rejected: "text-red-400" };

  const filteredIncidents = incidents.filter((t: any) => searchText ? `${t.incident_no} ${t.title} ${t.service_name}`.toLowerCase().includes(searchText.toLowerCase()) : true);
  const displayedIncidents = showAll ? filteredIncidents : filteredIncidents.slice(0, 10);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Task Board</h1>

      {/* ── Incident Table ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Incidents</h2>
            <span className="text-[10px] text-gray-400">{filteredIncidents.length} total</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
                placeholder="Filter..."
                className="bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-gray-600 w-48 focus:outline-none focus:border-indigo-300" />
              <span className="absolute left-2 top-1.5 text-gray-400 text-[11px]">🔍</span>
            </div>
          </div>
        </div>

        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/30 text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="text-left px-4 py-2 font-medium w-36">Incident</th>
              <th className="text-left px-2 py-2 font-medium">Title</th>
              <th className="text-center px-2 py-2 font-medium w-16">Status</th>
              <th className="text-center px-2 py-2 font-medium w-12">Sev</th>
              <th className="text-left px-2 py-2 font-medium w-24">Service</th>
              <th className="text-right px-4 py-2 font-medium w-12">Tasks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayedIncidents.map((t: any) => (
              <tr key={t.incident_no} onClick={() => loadTasks(t.incident_no)}
                className={`cursor-pointer transition-colors ${selected === t.incident_no ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                <td className="px-4 py-2.5">
                  <span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span>
                </td>
                <td className="px-2 py-2.5 text-gray-700 max-w-xs truncate">{t.title}</td>
                <td className="px-2 py-2.5 text-center">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${t.status === "resolved" ? "bg-emerald-50 text-emerald-600" : t.status === "investigating" ? "bg-amber-50 text-amber-600" : t.status === "open" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>{t.status}</span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className={`text-[9px] font-bold ${t.severity === "P0" ? "text-red-500" : t.severity === "P1" ? "text-orange-500" : "text-gray-500"}`}>{t.severity}</span>
                </td>
                <td className="px-2 py-2.5 text-gray-500 text-[10px]">{t.service_name}</td>
                <td className="px-4 py-2.5 text-right text-gray-400 text-[10px]">{t.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredIncidents.length > 10 && (
          <button onClick={() => setShowAll(!showAll)}
            className="w-full text-center py-2 text-[10px] text-gray-400 hover:text-gray-600 border-t border-gray-50 transition-colors">
            {showAll ? `Show fewer (10)` : `Show all ${filteredIncidents.length} incidents`}
          </button>
        )}
      </div>

      {/* ── Task Board ── */}
      {!selected ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">☰</div>
          <p className="text-gray-500 text-sm mb-1">Click an incident above to view its tasks</p>
          <p className="text-gray-400 text-xs">Select an incident from the table to see recommended tasks</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
          <div className="text-3xl mb-3">📭</div>
          <p className="text-gray-500 text-sm mb-1">No tasks for <span className="text-indigo-600 font-bold">{selected}</span></p>
          <p className="text-gray-400 text-xs mb-3">Tasks are auto-generated when the incident is updated</p>
          <div className="flex items-center justify-center gap-2">
            <button onClick={async () => { await fetch(`${API}/api/tasks/${selected}/generate`, { method: "POST" }); loadTasks(selected); }} className="btn-brand text-xs">Generate Tasks</button>
            <button onClick={() => setAddingNew(true)} className="btn-secondary text-xs">+ Add Custom</button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-700">
                  <span className="text-indigo-600 font-mono">{selected}</span>
                  <span className="text-gray-400 ml-2">— {tasks.length} tasks</span>
                </span>
                <button onClick={selectAll} className="text-[10px] text-gray-400 hover:text-gray-600">{selectedIds.size === tasks.length ? "Deselect" : "Select All"}</button>
                <span className="text-[10px] text-gray-400">{selectedIds.size > 0 ? `${selectedIds.size} selected` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                  placeholder="Assign to..."
                  className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] text-gray-600 w-28 focus:outline-none focus:border-indigo-300" />
                <button onClick={() => { loadHistory(); setShowHistory(!showHistory); }} className={`text-[10px] border rounded-lg px-2.5 py-1.5 font-medium ${showHistory ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "text-gray-500 border-gray-200 hover:border-gray-300"}`}>History</button>
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
              <span className="text-[10px] text-gray-400">{completed}/{tasks.length} ({pct}%)</span>
            </div>
          </div>

          {showHistory && history.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 max-h-48 overflow-y-auto">
              <h3 className="text-[10px] text-gray-400 uppercase font-bold mb-2">History</h3>
              {history.map((h,i) => (
                <div key={i} className="text-[9px] flex items-center gap-2 py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-400 font-mono w-12">{h.time}</span>
                  <span className={`font-bold w-14 ${h.action==="completed"?"text-emerald-500":h.action==="rejected"?"text-red-500":"text-gray-500"}`}>{h.action}</span>
                  <span className="text-gray-400 w-16 truncate">{h.by}</span>
                  <span className="text-gray-500 truncate flex-1">{h.detail}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-4">
            {tasks.filter((t) => filterStatus ? t.status === filterStatus : true).map((t) => (
              <div key={t.id} className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${selectedIds.has(t.id) ? "border-indigo-300 bg-indigo-50/20" : t.status === "completed" ? "border-emerald-200 bg-emerald-50/20" : t.status === "rejected" ? "border-red-200 bg-red-50/20 opacity-70" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="mt-1 w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 cursor-pointer" />
                <span className={`text-lg mt-0.5 ${SCOLOR[t.status]}`}>{ICON[t.status]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-indigo-600 text-xs font-bold font-mono">T{t.task_order.toString().padStart(2,"0")}</span>
                    {editingId === t.id ? (
                      <div className="flex-1 flex gap-2"><input value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700" autoFocus /><button onClick={() => { reviseTask(t.id, { description: editText }); setEditingId(null); }} className="text-xs text-indigo-600 font-medium">Save</button><button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button></div>
                    ) : <span className={`text-gray-700 text-xs ${t.status === "rejected" ? "line-through" : ""}`}>{t.description}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-gray-400">
                    <span>{t.source}</span>
                    {t.revised_by && <span className="text-indigo-500">· {t.revised_by}</span>}
                    {t.revision_note && <span className="text-gray-500">· {t.revision_note.slice(0,50)}</span>}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {!editingId && <button onClick={() => { setEditingId(t.id); setEditText(t.description); }} className="text-[9px] text-gray-400 hover:text-gray-600">✎</button>}
                    {assignTo && <button onClick={() => reviseTask(t.id, { revised_by: assignTo })} className="text-[9px] text-gray-400 hover:text-indigo-600 ml-1.5">👤</button>}
                    {t.status === "pending" && <button onClick={() => reviseTask(t.id, { status: "in_progress", revised_by: assignTo || "demo-user" })} className="text-[9px] text-indigo-500 font-medium ml-2">Accept</button>}
                    {t.status === "in_progress" && <button onClick={() => { const r=prompt("Result:"); if(r) reviseTask(t.id,{status:"completed",revision_note:r}); }} className="text-[9px] text-emerald-500 font-medium ml-2">Complete</button>}
                    {(t.status==="pending"||t.status==="in_progress") && <button onClick={()=>{const r=prompt("Reason:");if(r)reviseTask(t.id,{status:"rejected",revision_note:r});}} className="text-[9px] text-red-400 ml-2">Reject</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {addingNew ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <input value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="New task description..." onKeyDown={(e) => { if(e.key==="Enter"&&newTaskDesc.trim()){setAddingNew(false);setNewTaskDesc("");} }} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
              <div className="flex gap-2"><button onClick={() => { if(newTaskDesc.trim()){setAddingNew(false);setNewTaskDesc("");} }} className="btn-brand text-xs">Add</button><button onClick={()=>{setAddingNew(false);setNewTaskDesc("");}} className="btn-secondary text-xs">Cancel</button></div>
            </div>
          ) : (
            <button onClick={() => setAddingNew(true)} className="btn-secondary text-xs w-full text-center py-3 border-dashed rounded-xl">+ Add Custom Task</button>
          )}
        </>
      )}
    </div>
  );
}
