"use client";

import type { SwarmStats } from "@/lib/types";

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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
    <header className="topbar terminal-top">
      <div className="brand-block">
        <div className="brand">TTW // WORLD REPO</div>
        <div className="mission">
          <strong>{company}</strong>
          <span>{task}</span>
        </div>
      </div>

      <div className="stat-strip bloomberg-strip">
        <div>
          <em>AGENTS</em>
          <strong>{stats?.spawned ?? 0}</strong>
        </div>
        <div>
          <em>LIVE</em>
          <strong className="ok">{stats?.running ?? 0}</strong>
        </div>
        <div>
          <em>QUEUE</em>
          <strong>{stats?.queued ?? 0}</strong>
        </div>
        <div>
          <em>DONE</em>
          <strong>{stats?.completed ?? 0}</strong>
        </div>
        <div>
          <em>ENTS</em>
          <strong>{stats?.entities ?? 0}</strong>
        </div>
        <div>
          <em>LINKS</em>
          <strong>{stats?.relations ?? 0}</strong>
        </div>
        <div>
          <em>SOURCES</em>
          <strong className="ok">{stats?.sources ?? 0}</strong>
        </div>
        <div>
          <em>AGM</em>
          <strong>{stats?.agentsPerMin ?? 0}/m</strong>
        </div>
        <div>
          <em>FPM</em>
          <strong>{stats?.findsPerMin ?? 0}/m</strong>
        </div>
        <div>
          <em>CLOCK</em>
          <strong>{fmtDuration(stats?.elapsedMs ?? 0)}</strong>
        </div>
        <div>
          <em>FEED</em>
          <strong className={connected ? "ok" : "bad"}>
            {connected ? "LIVE" : "DROP"}
          </strong>
        </div>
      </div>

      <button type="button" className="stop-btn" onClick={onStop}>
        HALT
      </button>
    </header>
  );
}
