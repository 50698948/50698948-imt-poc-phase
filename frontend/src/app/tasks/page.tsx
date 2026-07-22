"use client"; import { useState, useEffect } from "react";
const API = "http://localhost:8000";

interface Task { id: string; task_order: number; description: string; source: string; status: string; revised_by: string | null; revision_note: string | null; }

export default function TaskBoardPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    fetch(`${API}/api/tickets?limit=50`).then((r) => r.json()).then(setIncidents);
  }, []);

  const filteredIncidents = incidents.filter((t: any) =>
    filterText ? `${t.incident_no} ${t.title}`.toLowerCase().includes(filterText.toLowerCase()) : true
  );

  const loadTasks = async (no: string) => {
    setSelected(no); setLoading(true);
    try {
      const res = await fetch(`${API}/api/tasks/${no}`).then((r) => r.json());
      setTasks(Array.isArray(res) ? res : []);
    } catch { setTasks([]); }
    setLoading(false);
  };

  const revise = async (id: string, status: string, note: string = "") => {
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, revision_note: note || undefined, revised_by: "demo-user" }),
    });
    await loadTasks(selected);
  };

  const editDescription = async (id: string, desc: string) => {
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc, revised_by: "demo-user" }),
    });
    setEditingId(null);
    await loadTasks(selected);
  };

  const deleteTask = async (id: string) => {
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "deleted", revised_by: "demo-user", revision_note: "Manually removed" }),
    });
    await loadTasks(selected);
  };

  const filtered = filterStatus ? tasks.filter((t) => t.status === filterStatus) : tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const ICON: Record<string, string> = { pending: "○", in_progress: "◐", completed: "●", rejected: "✕", deleted: " " };
  const SCOLOR: Record<string, string> = { pending: "text-gray-400", in_progress: "text-amber-500", completed: "text-emerald-500", rejected: "text-red-400", deleted: "text-gray-300" };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Task Board</h1>
          <p className="text-gray-500 text-xs mt-1">Review, confirm, modify, and delete recommended tasks per incident</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Incident selector */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50/50">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select Incident</span>
          </div>
          <div className="p-2">
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter incidents..."
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 mb-2 focus:outline-none focus:border-indigo-300" />
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
            {filteredIncidents.map((t: any) => (
              <button key={t.incident_no} onClick={() => loadTasks(t.incident_no)}
                className={`w-full text-left px-3 py-2.5 transition-colors text-xs ${selected === t.incident_no ? "bg-indigo-50 border-l-2 border-indigo-500" : "hover:bg-gray-50 border-l-2 border-transparent"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-indigo-600 font-bold font-mono text-[10px]">{t.incident_no}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${t.status === "resolved" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{t.status}</span>
                </div>
                <div className="text-gray-600 text-[10px] truncate">{t.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="col-span-9">
          {!selected ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-4xl mb-3">☰</div>
              <p className="text-gray-500 text-sm mb-1">Select an incident to view its tasks</p>
              <p className="text-gray-400 text-xs">Tasks are auto-generated when the incident is updated</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-gray-500 text-sm mb-1">No tasks for {selected}</p>
              <p className="text-gray-400 text-xs">Update the incident or run lifecycle demo to generate tasks</p>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">{selected} — Progress</span>
                  <span className="text-xs text-gray-500">{completed}/{tasks.length} completed ({pct}%)</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex gap-3 mt-2 text-[10px]">
                  {["pending", "in_progress", "completed", "rejected"].map((s) => {
                    const c = tasks.filter((t) => t.status === s).length;
                    if (c === 0) return null;
                    return <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
                      className={`${filterStatus === s ? "font-bold underline" : ""} ${SCOLOR[s]}`}>{ICON[s]} {s} ({c})</button>;
                  })}
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                {filtered.map((t) => (
                  <div key={t.id} className={`bg-white border rounded-xl p-4 transition-all ${t.status === "completed" ? "border-emerald-200 bg-emerald-50/30" : t.status === "rejected" ? "border-red-200 bg-red-50/30 line-through" : "border-gray-200 hover:border-gray-300"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`text-lg mt-0.5 ${SCOLOR[t.status]}`}>{ICON[t.status]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-indigo-600 text-xs font-bold font-mono">T{t.task_order.toString().padStart(2, "0")}</span>
                          {editingId === t.id ? (
                            <div className="flex-1 flex gap-2">
                              <input value={editText} onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
                              <button onClick={() => editDescription(t.id, editText)} className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                            </div>
                          ) : (
                            <span className="text-gray-700 text-xs">{t.description}</span>
                          )}
                          <button onClick={() => { setEditingId(t.id); setEditText(t.description); }} className="text-gray-400 hover:text-gray-600 text-[10px] ml-1" title="Edit">✎</button>
                          {t.status !== "deleted" && (
                            <button onClick={() => deleteTask(t.id)} className="text-gray-400 hover:text-red-500 text-[10px] ml-1" title="Delete">🗑</button>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-400">src: {t.source}</div>
                        {t.revision_note && (
                          <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] text-gray-600 mt-2 border border-gray-100">{t.revision_note}</div>
                        )}
                        <div className="flex gap-2 mt-2">
                          {t.status === "pending" && (
                            <>
                              <button onClick={() => revise(t.id, "in_progress")} className="text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded px-2.5 py-1 font-medium">Accept</button>
                              <button onClick={() => revise(t.id, "rejected", prompt("Reason:") || "")} className="text-[10px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded px-2.5 py-1">Reject</button>
                            </>
                          )}
                          {t.status === "in_progress" && (
                            <>
                              <button onClick={() => revise(t.id, "completed", prompt("Result:") || "Done")} className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded px-2.5 py-1 font-medium">Complete</button>
                              <button onClick={() => revise(t.id, "rejected", prompt("Reason:") || "")} className="text-[10px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded px-2.5 py-1">Reject</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add custom task */}
              <div className="mt-4">
                {addingNew ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2">
                    <input value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="New task description..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
                    <button onClick={() => { if (newTaskDesc.trim()) { setAddingNew(false); setNewTaskDesc(""); } }} className="btn-brand text-xs">Add</button>
                    <button onClick={() => setAddingNew(false)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingNew(true)} className="btn-secondary text-xs w-full text-center py-3 border-dashed">+ Add Custom Task</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
