"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

interface Task { id: string; task_order: number; description: string; source: string; status: string; revised_by: string | null; revision_note: string | null; }

export default function TaskBoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [addingNew, setAddingNew] = useState(false);

  const load = async () => {
    try {
      await fetch(`${API}/api/seed`, { method: "POST" });
      await fetch(`${API}/api/lifecycle`, { method: "POST" });
      const res = await fetch(`${API}/api/tasks/INC-2025-0001`).then((r) => r.json());
      setTasks(Array.isArray(res) ? res : []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  const revise = async (id: string, status: string, note: string = "") => {
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, revision_note: note || undefined, revised_by: "demo-user" }),
    });
    await load();
  };

  const editDescription = async (id: string, desc: string) => {
    await fetch(`${API}/api/tasks/${id}/revise`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc, revised_by: "demo-user" }),
    });
    setEditingId(null);
    await load();
  };

  const filtered = filterStatus ? tasks.filter((t) => t.status === filterStatus) : tasks;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const ICON = { pending: "○", in_progress: "◐", completed: "●", rejected: "✕" } as Record<string,string>;
  const SCOLOR = { pending: "text-gray-400", in_progress: "text-amber-500", completed: "text-emerald-500", rejected: "text-red-400" } as Record<string,string>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Task Board — INC-2025-0001</h1><p className="text-gray-500 text-xs mt-1">Review, accept, reject, and edit recommended tasks</p></div>
        <button onClick={load} className="btn-secondary text-xs">⟳ Reload</button>
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Progress</span>
          <span className="text-xs text-gray-500">{completed}/{tasks.length} completed ({pct}%)</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-3 mt-2 text-[10px]">
          {["pending","in_progress","completed","rejected"].map((s) => {
            const c = tasks.filter((t) => t.status === s).length;
            return <button key={s} onClick={() => setFilterStatus(filterStatus===s?"":s)} className={`${filterStatus===s?"font-bold underline":""} ${SCOLOR[s]}`}>{ICON[s]} {s} ({c})</button>;
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((t) => (
          <div key={t.id} className={`bg-white border rounded-xl p-4 transition-all ${t.status==="completed"?"border-emerald-200 bg-emerald-50/30":t.status==="rejected"?"border-red-200 bg-red-50/30":"border-gray-200 hover:border-gray-300"}`}>
            <div className="flex items-start gap-3">
              <span className={`text-lg mt-0.5 ${SCOLOR[t.status]}`}>{ICON[t.status]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-indigo-600 text-xs font-bold font-mono">T{t.task_order.toString().padStart(2,"0")}</span>
                  {editingId === t.id ? (
                    <div className="flex-1 flex gap-2">
                      <input value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700" autoFocus />
                      <button onClick={() => editDescription(t.id, editText)} className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <span className="text-gray-700 text-xs">{t.description}</span>
                  )}
                  {!editingId && <button onClick={() => { setEditingId(t.id); setEditText(t.description); }} className="text-gray-400 hover:text-gray-600 text-[10px]">✎</button>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-2">
                  <span>src: {t.source}</span>
                  {t.revised_by && <span>· {t.revised_by}</span>}
                </div>
                {t.revision_note && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] text-gray-600 mb-2 border border-gray-100">{t.revision_note}</div>
                )}
                {t.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => revise(t.id, "in_progress", "Started working on this task")} className="text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded px-2.5 py-1 font-medium">Accept</button>
                    <button onClick={() => revise(t.id, "rejected", prompt("Rejection reason:") || "Not applicable")} className="text-[10px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded px-2.5 py-1">Reject</button>
                  </div>
                )}
                {t.status === "in_progress" && (
                  <div className="flex gap-2">
                    <button onClick={() => revise(t.id, "completed", prompt("Result/evidence:") || "Completed")} className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded px-2.5 py-1 font-medium">Mark Completed</button>
                    <button onClick={() => revise(t.id, "rejected", prompt("Rejection reason:") || "Not applicable")} className="text-[10px] bg-white border border-gray-200 hover:border-gray-300 text-gray-600 rounded px-2.5 py-1">Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Custom Task */}
      <div className="mt-4">
        {addingNew ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2">
            <input value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="Enter new task description..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-indigo-300" autoFocus />
            <button onClick={() => { if(newTaskDesc.trim()){ setAddingNew(false); setNewTaskDesc(""); } }} className="btn-brand text-xs">Add Task</button>
            <button onClick={() => setAddingNew(false)} className="btn-secondary text-xs">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingNew(true)} className="btn-secondary text-xs w-full text-center py-3 border-dashed">+ Add Custom Task</button>
        )}
      </div>
    </div>
  );
}
