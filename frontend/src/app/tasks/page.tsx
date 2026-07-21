"use client";

import { useState, useEffect } from "react";

const API = "http://localhost:8000";

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  in_progress: "◐",
  completed: "●",
  rejected: "✕",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-gray-400",
  in_progress: "text-yellow-400",
  completed: "text-green-400",
  rejected: "text-red-400",
};

interface Task {
  id: string;
  task_order: number;
  description: string;
  source: string;
  status: string;
  revised_by: string | null;
  revision_note: string | null;
}

export default function TaskBoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviseForm, setReviseForm] = useState({ status: "", revision_note: "", revised_by: "demo-user" });

  const load = async () => {
    try {
      await fetch(`${API}/api/seed`, { method: "POST" });
      await fetch(`${API}/api/lifecycle`, { method: "POST" });
      const res = await fetch(`${API}/api/tasks/INC-2025-0001`);
      setTasks(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { load(); }, []);

  const revise = async () => {
    if (!selectedTask || !reviseForm.status) return;
    setLoading(true);
    const body: any = { status: reviseForm.status, revised_by: reviseForm.revised_by };
    if (reviseForm.revision_note) body.revision_note = reviseForm.revision_note;
    await fetch(`${API}/api/tasks/${selectedTask.id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    setSelectedTask(null);
    setReviseForm({ status: "", revision_note: "", revised_by: "demo-user" });
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl text-cyan-400 font-bold">Task Board — INC-2025-0001</h1>
          <p className="text-gray-500 text-xs mt-1">Human-revisable engineer recommendations</p>
        </div>
        <button onClick={load} className="bg-gray-800 hover:bg-gray-700 text-gray-300 rounded px-3 py-1 text-xs uppercase">
          Reload
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Task List */}
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id}
              onClick={() => setSelectedTask(t)}
              className={`bg-gray-900 border rounded-lg p-3 cursor-pointer transition-colors hover:border-cyan-700 ${selectedTask?.id === t.id ? "border-cyan-500" : "border-gray-800"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm ${STATUS_COLOR[t.status]}`}>{STATUS_ICON[t.status]}</span>
                <span className="text-cyan-400 text-xs font-bold">T{t.task_order.toString().padStart(2, "0")}</span>
                <span className={`text-[10px] ${STATUS_COLOR[t.status]}`}>{t.status}</span>
              </div>
              <p className="text-gray-300 text-xs">{t.description}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-gray-600 text-[10px]">src: {t.source}</span>
                {t.revised_by && <span className="text-gray-500 text-[10px]">by: {t.revised_by}</span>}
              </div>
              {t.revision_note && <p className="text-gray-500 text-[10px] mt-1 italic">{t.revision_note}</p>}
            </div>
          ))}
        </div>

        {/* Revision Panel */}
        {selectedTask && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-fit sticky top-20">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Revise Task</h3>
            <p className="text-gray-300 text-sm mb-3">{selectedTask.description}</p>

            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase">New Status</label>
              <select value={reviseForm.status}
                onChange={(e) => setReviseForm({ ...reviseForm, status: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                <option value="">Select...</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <label className="text-[10px] text-gray-500 uppercase">Note</label>
              <textarea value={reviseForm.revision_note}
                onChange={(e) => setReviseForm({ ...reviseForm, revision_note: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 h-20 resize-none" />

              <button onClick={revise} disabled={loading || !reviseForm.status}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded px-3 py-1.5 text-xs font-bold uppercase w-full">
                {loading ? "Saving..." : "Save Revision"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
