"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwarm } from "@/hooks/useSwarm";
import { AgentBoard } from "@/components/AgentBoard";
import { EntityView } from "@/components/EntityView";
import { GraphMap } from "@/components/GraphMap";
import { RepoSearch } from "@/components/RepoSearch";
import { Sidebar } from "@/components/Sidebar";
import { StatsBar } from "@/components/StatsBar";
import { Tape } from "@/components/Tape";

type View = "map" | "dive" | "agents" | "search";

const NAV: Array<{ id: View; label: string; hint: string }> = [
  { id: "map", label: "1) Rel Map", hint: "Hub & spokes" },
  { id: "dive", label: "2) Deep Dive", hint: "FA desk" },
  { id: "agents", label: "3) Agents", hint: "Live work" },
  { id: "search", label: "4) Search", hint: "Find anything" },
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
    deepDive,
    error,
  } = useSwarm(sessionId);
  const [selectedEntityId, setSelectedEntityId] = useState<string>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [view, setView] = useState<View>("map");
  const [tapeOpen, setTapeOpen] = useState(true);
  const [diving, setDiving] = useState(false);
  const [diveMsg, setDiveMsg] = useState<string | null>(null);

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

  const openDive = useCallback(
    async (id: string, spawn = true) => {
      setSelectedEntityId(id);
      setView("dive");
      if (!spawn) return;
      const ent = entities.find((e) => e.id === id);
      if (!ent) return;
      setDiving(true);
      setDiveMsg(null);
      try {
        const res = await deepDive(id, ent.name);
        setDiveMsg(
          res.spawned > 0
            ? `Deep dive · ${res.name} · +${res.spawned} agents queued`
            : `Deep dive · ${res.name} · dossier already running`,
        );
      } catch (err) {
        setDiveMsg(err instanceof Error ? err.message : "Deep dive failed");
      } finally {
        setDiving(false);
      }
    },
    [deepDive, entities],
  );

  return (
    <div className="workspace bb-terminal">
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
      {(error || diveMsg) && (
        <div className="banner">{diveMsg || error}</div>
      )}

      <nav className="view-tabs bb-view-tabs" aria-label="Workspace">
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
          onSelect={(id) => void openDive(id, true)}
          view={view === "map" ? "map" : "page"}
          onViewChange={(v) => setView(v === "map" ? "map" : "dive")}
        />

        <main className="main-pane" key={view}>
          {view === "map" && (
            <GraphMap
              entities={entities}
              relations={relations}
              selectedId={selectedEntityId}
              rootCompany={session?.company || ""}
              onSelect={(id) => void openDive(id, true)}
              onDeepDive={(id) => void openDive(id, true)}
            />
          )}
          {view === "agents" && (
            <AgentBoard
              tasks={tasks}
              selectedId={selectedAgentId}
              onSelect={setSelectedAgentId}
            />
          )}
          {view === "dive" && (
            <EntityView
              entity={selectedEntity}
              relations={relations}
              entities={entities}
              diving={diving}
              onSelect={(id) => void openDive(id, true)}
              onDeepDive={(id) => void openDive(id, true)}
            />
          )}
          {view === "search" && (
            <div className="search-pane">
              <div className="pane-intro">
                <h2>4) Search repository</h2>
                <p>Find companies, products, people, and sources — click to dive.</p>
              </div>
              <RepoSearch
                sessionId={sessionId}
                onSelect={(e) => void openDive(e.id, true)}
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
