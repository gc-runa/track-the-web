"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, ResearchTask } from "@/lib/types";

const LEVEL: Record<LogEntry["level"], string> = {
  info: "Info",
  spawn: "Spawn",
  find: "Find",
  error: "Error",
  warn: "Warn",
  system: "System",
  source: "Source",
};

export function Tape({
  logs,
  selectedAgentId,
  selectedTask,
}: {
  logs: LogEntry[];
  selectedAgentId?: string;
  selectedTask?: ResearchTask;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const filtered = selectedAgentId
    ? logs.filter(
        (l) =>
          l.agentId === selectedAgentId || l.parentId === selectedAgentId,
      )
    : logs;

  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [filtered.length, selectedAgentId]);

  return (
    <aside className="tape-panel">
      <div className="panel-head">
        <h2>Activity</h2>
        <span>{filtered.length}</span>
      </div>

      {selectedTask && (
        <div className="agent-inspect">
          <div className="inspect-phase">
            {selectedTask.phase.replace(/_/g, " ")}
          </div>
          <p className="inspect-focus">{selectedTask.focus}</p>
          <p className="inspect-activity">{selectedTask.activity}</p>
        </div>
      )}

      <div
        className="tape-scroll"
        ref={scrollerRef}
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 64;
        }}
      >
        {filtered.length === 0 && (
          <p className="muted pad">Activity will stream here.</p>
        )}
        {filtered.map((log) => (
          <div key={log.id} className={`tape-row lvl-${log.level}`}>
            <div className="tape-meta">
              <span className="tape-time">
                {new Date(log.ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="tape-lvl">{LEVEL[log.level]}</span>
            </div>
            <p className="tape-msg">{log.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
