"use client";

import { useEffect, useState } from "react";
import type { ResearchTask } from "@/lib/types";

function elapsed(task: ResearchTask, now: number) {
  const start = task.startedAt || task.createdAt;
  const end = task.finishedAt || now;
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<string, string> = {
  queued: "QUEUED",
  briefing: "BRIEF",
  searching_web: "WEB",
  calling_hy3: "HY3",
  parsing: "PARSE",
  writing_map: "WRITE",
  spawning: "SPAWN",
  done: "DONE",
  failed: "FAIL",
};

export function AgentBoard({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: ResearchTask[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const running = tasks.filter((t) => t.status === "running");
  const queued = tasks.filter((t) => t.status === "queued").slice(0, 24);
  const recent = tasks
    .filter((t) => t.status === "done" || t.status === "failed")
    .slice(0, 12);

  return (
    <div className="agent-board">
      <div className="board-section">
        <div className="board-label">
          LIVE AGENTS <span>{running.length}</span>
        </div>
        <div className="agent-grid">
          {running.length === 0 && (
            <div className="agent-empty">Awaiting Hy3 workers…</div>
          )}
          {running.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`agent-card live ${selectedId === t.id ? "active" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="agent-card-top">
                <span className={`phase phase-${t.phase}`}>
                  {PHASE_LABEL[t.phase] || t.phase}
                </span>
                <span className="agent-time">{elapsed(t, now)}</span>
              </div>
              <div className="agent-id">{t.id}</div>
              <div className="agent-focus">{t.focus}</div>
              <div className="agent-activity">{t.activity}</div>
              <div className="agent-card-foot">
                <span>d{t.depth}</span>
                <span>finds {t.findsCount}</span>
                <span>spawn {t.spawnCount}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="board-section">
        <div className="board-label">
          QUEUE <span>{queued.length}+</span>
        </div>
        <div className="queue-list">
          {queued.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`queue-row ${selectedId === t.id ? "active" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <span className="q-pri">P{t.priority}</span>
              <span className="q-id">{t.id}</span>
              <span className="q-focus">{t.focus}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="board-section">
        <div className="board-label">RECENT</div>
        <div className="queue-list">
          {recent.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`queue-row done ${selectedId === t.id ? "active" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <span className={`phase phase-${t.phase}`}>
                {PHASE_LABEL[t.phase]}
              </span>
              <span className="q-id">{t.id}</span>
              <span className="q-focus">
                {t.lastNarrative || t.activity || t.focus}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
