"use client";

import type { SwarmStats } from "@/lib/types";

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function StatsBar({
  company,
  task,
  stats,
  connected,
  onStop,
}: {
  company: string;
  task: string;
  stats?: SwarmStats;
  connected: boolean;
  onStop: () => void;
}) {
  return (
    <header className="topbar bb-topbar">
      <div className="brand-block">
        <div className="brand">Track the Web</div>
        <div className="mission">
          <strong className="bb-equity">{company}</strong>
          <span title={task}>{task}</span>
        </div>
      </div>

      <div className="stat-strip" aria-label="Live metrics">
        <div>
          <em>Live</em>
          <strong className="ok">{stats?.running ?? 0}</strong>
        </div>
        <div>
          <em>Queue</em>
          <strong>{stats?.queued ?? 0}</strong>
        </div>
        <div>
          <em>Entities</em>
          <strong>{stats?.entities ?? 0}</strong>
        </div>
        <div>
          <em>Links</em>
          <strong>{stats?.relations ?? 0}</strong>
        </div>
        <div>
          <em>Sources</em>
          <strong>{stats?.sources ?? 0}</strong>
        </div>
        <div>
          <em>Time</em>
          <strong>{fmtDuration(stats?.elapsedMs ?? 0)}</strong>
        </div>
        <div>
          <em>Feed</em>
          <strong className={connected ? "ok" : "bad"}>
            {connected ? "LIVE" : "OFF"}
          </strong>
        </div>
      </div>

      <button type="button" className="stop-btn" onClick={onStop}>
        98) Stop
      </button>
    </header>
  );
}
