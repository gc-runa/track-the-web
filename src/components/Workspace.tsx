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

type View = "map" | "agents" | "page" | "search";

const NAV: Array<{ id: View; label: string; hint: string }> = [
  { id: "map", label: "Map", hint: "Visual network" },
  { id: "agents", label: "Agents", hint: "Live work" },
  { id: "page", label: "Page", hint: "Entity detail" },
  { id: "search", label: "Search", hint: "Find anything" },
];

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
  const [view, setView] = useState<View>("map");
  const [tapeOpen, setTapeOpen] = useState(true);

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
    <div className="workspace">
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

      <nav className="view-tabs" aria-label="Workspace">
        <a href="/" className="tab-home">
          Home
        </a>
        <a href="/library" className="tab-home">
          Library
        </a>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "active" : ""}
            onClick={() => setView(item.id)}
          >
            <span className="tab-label">{item.label}</span>
            <span className="tab-hint">{item.hint}</span>
          </button>
        ))}
        <button
          type="button"
          className={`tape-toggle ${tapeOpen ? "on" : ""}`}
          onClick={() => setTapeOpen((v) => !v)}
        >
          {tapeOpen ? "Hide log" : "Show log"}
        </button>
      </nav>

      <div className={`workspace-body ${tapeOpen ? "with-tape" : "no-tape"}`}>
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

        <main className="main-pane" key={view}>
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
          {view === "agents" && (
            <AgentBoard
              tasks={tasks}
              selectedId={selectedAgentId}
              onSelect={setSelectedAgentId}
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
              <div className="pane-intro">
                <h2>Search repository</h2>
                <p>Find companies, products, people, and sources already mapped.</p>
              </div>
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

        {tapeOpen && (
          <Tape
            logs={logs}
            selectedAgentId={selectedAgentId}
            selectedTask={selectedTask}
          />
        )}
      </div>
    </div>
  );
}
