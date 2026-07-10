"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, ResearchTask } from "@/lib/types";

const LEVEL: Record<LogEntry["level"], string> = {
  info: "INF",
  spawn: "SPN",
  find: "FND",
  error: "ERR",
  warn: "WRN",
  system: "SYS",
  source: "SRC",
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
      <div className="panel-head terminal-head">
        <h2>TAPE</h2>
        <span>{filtered.length} ticks</span>
      </div>

      {selectedTask && (
        <div className="agent-inspect">
          <div className="inspect-id">{selectedTask.id}</div>
          <div className="inspect-phase">{selectedTask.phase}</div>
          <p className="inspect-focus">{selectedTask.focus}</p>
          <p className="inspect-activity">{selectedTask.activity}</p>
          {selectedTask.lastNarrative && (
            <p className="inspect-narrative">{selectedTask.lastNarrative}</p>
          )}
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
        {filtered.map((log) => (
          <div key={log.id} className={`tape-row lvl-${log.level}`}>
            <span className="tape-time">
              {new Date(log.ts).toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="tape-lvl">{LEVEL[log.level]}</span>
            <span className="tape-agent">{log.agentId.replace("agent_", "")}</span>
            <span className="tape-msg">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
