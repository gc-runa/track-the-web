"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/types";

const LEVEL_LABEL: Record<LogEntry["level"], string> = {
  info: "INFO",
  spawn: "SPAWN",
  find: "FIND",
  error: "ERROR",
  warn: "WARN",
  system: "SYS",
  source: "SRC",
};

export function AgentLog({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <aside className="log-panel">
      <div className="panel-head">
        <h2>Live agent log</h2>
        <span>{logs.length} events</span>
      </div>
      <div
        className="log-scroll"
        ref={scrollerRef}
        onScroll={() => {
          const el = scrollerRef.current;
          if (!el) return;
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {logs.length === 0 && (
          <p className="muted">Waiting for swarm activity…</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className={`log-row level-${log.level}`}>
            <div className="log-meta">
              <span className="log-level">{LEVEL_LABEL[log.level]}</span>
              <span className="log-time">
                {new Date(log.ts).toLocaleTimeString()}
              </span>
              <span className="log-agent">{log.agentId}</span>
            </div>
            <p>{log.message}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </aside>
  );
}
