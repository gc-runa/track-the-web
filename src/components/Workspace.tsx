"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwarm } from "@/hooks/useSwarm";
import { AgentBoard } from "@/components/AgentBoard";
import { EntityView } from "@/components/EntityView";
import { GraphMap } from "@/components/GraphMap";
import { RepoSearch } from "@/components/RepoSearch";
import { Sidebar } from "@/components/Sidebar";
import { StatsBar } from "@/components/StatsBar";
import { Tape } from "@/components/Tape";

type View = "agents" | "map" | "page" | "search";

export function Workspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const {
    session,
    entities,
    relations,
    logs,
    tasks,
    stats,
    connected,
    stop,
    error,
  } = useSwarm(sessionId);
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [view, setView] = useState<View>("agents");

  const selectedEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId),
    [entities, selectedEntityId],
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedAgentId),
    [tasks, selectedAgentId],
  );

  useEffect(() => {
    if (!selectedEntityId && entities[0]) setSelectedEntityId(entities[0].id);
  }, [entities, selectedEntityId]);

  useEffect(() => {
    const live = tasks.find((t) => t.status === "running");
    if (!selectedAgentId && live) setSelectedAgentId(live.id);
  }, [tasks, selectedAgentId]);

  return (
    <div className="workspace terminal-workspace">
      <StatsBar
        company={session?.company || "…"}
        task={session?.task || "…"}
        stats={stats}
        connected={connected}
        onStop={async () => {
          await stop();
          router.push("/");
        }}
      />
      {error && <div className="banner">{error}</div>}

      <div className="view-tabs">
        <button
          type="button"
          className={view === "agents" ? "active" : ""}
          onClick={() => setView("agents")}
        >
          AGENTS
        </button>
        <button
          type="button"
          className={view === "map" ? "active" : ""}
          onClick={() => setView("map")}
        >
          MAP
        </button>
        <button
          type="button"
          className={view === "page" ? "active" : ""}
          onClick={() => setView("page")}
        >
          PAGE
        </button>
        <button
          type="button"
          className={view === "search" ? "active" : ""}
          onClick={() => setView("search")}
        >
          SEARCH
        </button>
      </div>

      <div className="workspace-body terminal-body">
        <Sidebar
          entities={entities}
          selectedId={selectedEntityId}
          onSelect={(id) => {
            setSelectedEntityId(id);
            setView("page");
          }}
          view={view === "map" ? "map" : "page"}
          onViewChange={(v) => setView(v === "map" ? "map" : "page")}
        />

        <main className="main-pane">
          {view === "agents" && (
            <AgentBoard
              tasks={tasks}
              selectedId={selectedAgentId}
              onSelect={setSelectedAgentId}
            />
          )}
          {view === "map" && (
            <GraphMap
              entities={entities}
              relations={relations}
              selectedId={selectedEntityId}
              onSelect={(id) => {
                setSelectedEntityId(id);
                setView("page");
              }}
            />
          )}
          {view === "page" && (
            <EntityView
              entity={selectedEntity}
              relations={relations}
              entities={entities}
              onSelect={setSelectedEntityId}
            />
          )}
          {view === "search" && (
            <div className="search-pane">
              <RepoSearch
                sessionId={sessionId}
                onSelect={(e) => {
                  setSelectedEntityId(e.id);
                  setView("page");
                }}
              />
            </div>
          )}
        </main>

        <Tape
          logs={logs}
          selectedAgentId={selectedAgentId}
          selectedTask={selectedTask}
        />
      </div>
    </div>
  );
}
