"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Entity,
  LogEntry,
  Relation,
  ResearchTask,
  SessionState,
  SwarmEvent,
  SwarmStats,
} from "@/lib/types";

export function useSwarm(sessionId?: string) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const applyEvent = useCallback((event: SwarmEvent) => {
    setSession((prev) => {
      if (!prev && event.type !== "session") return prev;
      const base =
        event.type === "session"
          ? event.session
          : prev
            ? { ...prev }
            : null;
      if (!base) return prev;

      switch (event.type) {
        case "session":
          return event.session;
        case "log":
          return {
            ...base,
            logs: [...base.logs, event.log].slice(-500),
          };
        case "entity": {
          const idx = base.entities.findIndex((e) => e.id === event.entity.id);
          const entities =
            idx >= 0
              ? base.entities.map((e, i) => (i === idx ? event.entity : e))
              : [event.entity, ...base.entities];
          return {
            ...base,
            entities,
            stats: { ...base.stats, entities: entities.length },
          };
        }
        case "relation": {
          const exists = base.relations.some((r) => r.id === event.relation.id);
          const relations = exists
            ? base.relations
            : [event.relation, ...base.relations];
          return {
            ...base,
            relations,
            stats: { ...base.stats, relations: relations.length },
          };
        }
        case "task": {
          const idx = base.tasks.findIndex((t) => t.id === event.task.id);
          const tasks =
            idx >= 0
              ? base.tasks.map((t, i) => (i === idx ? event.task : t))
              : [event.task, ...base.tasks];
          return { ...base, tasks: tasks.slice(0, 400) };
        }
        case "stats":
          return { ...base, stats: event.stats };
        case "heartbeat":
          return {
            ...base,
            stats: {
              ...base.stats,
              elapsedMs: Date.now() - base.stats.startedAt,
            },
          };
        default:
          return base;
      }
    });
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const es = new EventSource(`/api/research/stream?id=${sessionId}`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SwarmEvent;
        applyEvent(event);
      } catch {
        /* ignore malformed */
      }
    };

    es.onerror = () => {
      setConnected(false);
      // Historical / cold session: load forever store once
      void fetch(`/api/research/state?id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled || !data.session) {
            setError("Live stream reconnecting…");
            return;
          }
          setSession(data.session as SessionState);
          setError(
            data.source === "postgres"
              ? "Viewing saved repository (swarm not live)"
              : null,
          );
        })
        .catch(() => setError("Live stream reconnecting…"));
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [sessionId, applyEvent]);

  const start = useCallback(async (company: string, task: string) => {
    setError(null);
    const res = await fetch("/api/research/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, task }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start");
    setSession(data.session as SessionState);
    return data.session as SessionState;
  }, []);

  const stop = useCallback(async () => {
    if (!session?.id) return;
    await fetch("/api/research/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });
  }, [session?.id]);

  const deepDive = useCallback(
    async (entityId: string, entityName?: string) => {
      if (!session?.id) throw new Error("No live session");
      const res = await fetch("/api/research/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          entityId,
          entityName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deep dive failed");
      return data as { spawned: number; name: string };
    },
    [session?.id],
  );

  return {
    session,
    connected,
    error,
    start,
    stop,
    deepDive,
    entities: (session?.entities || []) as Entity[],
    relations: (session?.relations || []) as Relation[],
    logs: (session?.logs || []) as LogEntry[],
    tasks: (session?.tasks || []) as ResearchTask[],
    stats: session?.stats as SwarmStats | undefined,
  };
}
