"use client";

import { useEffect, useState } from "react";
import type { ResearchTask } from "@/lib/types";

function elapsed(task: ResearchTask, now: number) {
  const start = task.startedAt || task.createdAt;
  const end = task.finishedAt || now;
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0
    ? `${m}:${String(r).padStart(2, "0")}`
    : `0:${String(r).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<string, string> = {
  queued: "Queued",
  briefing: "Briefing",
  searching_web: "Searching",
  calling_hy3: "Thinking",
  parsing: "Parsing",
  writing_map: "Writing",
  spawning: "Spawning",
  done: "Done",
  failed: "Failed",
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
  const queued = tasks.filter((t) => t.status === "queued").slice(0, 18);
  const recent = tasks
    .filter((t) => t.status === "done" || t.status === "failed")
    .slice(0, 10);

  return (
    <div className="agent-board">
      <div className="pane-intro">
        <h2>Live agents</h2>
        <p>Each worker searches the web, cites sources, then forks the next leads.</p>
      </div>

      <section className="board-section">
        <div className="board-label">
          Working now <span>{running.length}</span>
        </div>
        <div className="agent-grid">
          {running.length === 0 && (
            <div className="agent-empty">Waiting for the next worker…</div>
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
              <div className="agent-focus">{t.focus}</div>
              <div className="agent-activity">{t.activity}</div>
              <div className="agent-card-foot">
                <span>Depth {t.depth}</span>
                <span>{t.findsCount} finds</span>
                <span>{t.spawnCount} children</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="board-section">
        <div className="board-label">
          Up next <span>{queued.length}</span>
        </div>
        <div className="queue-list">
          {queued.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`queue-row ${selectedId === t.id ? "active" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <span className="q-pri">{t.priority}</span>
              <span className="q-focus">{t.focus}</span>
            </button>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="board-section">
          <div className="board-label">Recently finished</div>
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
                <span className="q-focus">
                  {t.lastNarrative || t.activity || t.focus}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
