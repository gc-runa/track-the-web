"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LibraryPayload = {
  stats: {
    sessions: number;
    entities: number;
    relations: number;
    sources: number;
  };
  sessions: Array<{
    id: string;
    company: string;
    task: string;
    status: string;
    entityCount: number;
    relationCount: number;
    sourceCount: number;
    updatedAt: string;
    live: boolean;
  }>;
  recent: Array<{
    id: string;
    sessionId: string;
    type: string;
    name: string;
    summary: string;
    sources: number;
  }>;
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function LibraryApp() {
  const router = useRouter();
  const [data, setData] = useState<LibraryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [task, setTask] = useState(
    "Map the full ecosystem with source-backed detail.",
  );
  const [starting, setStarting] = useState(false);
  const [q, setQ] = useState("");
  const [searchHits, setSearchHits] = useState<
    Array<{
      id: string;
      type: string;
      name: string;
      summary: string;
      sessionId?: string;
    }>
  >([]);

  async function load() {
    const res = await fetch("/api/library");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load library");
      return;
    }
    setData(json);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  const liveCount = useMemo(
    () => data?.sessions.filter((s) => s.live).length ?? 0,
    [data],
  );

  async function startResearch(e: FormEvent) {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/research/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, task }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start");
      router.push(`/workspace/${json.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setStarting(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const res = await fetch(
      `/api/research/search?q=${encodeURIComponent(q.trim())}`,
    );
    const json = await res.json();
    setSearchHits(json.entities || []);
  }

  if (!data) {
    return (
      <div className="library-shell library-loading">
        <div className="boot-pulse" />
        <p>Opening the public repository…</p>
      </div>
    );
  }

  return (
    <div className="library-shell">
      <div className="library-atmosphere" aria-hidden>
        <div className="start-grid" />
        <div className="start-glow library-glow" />
      </div>

      <header className="library-top">
        <div>
          <Link href="/" className="brand">
            Track the Web
          </Link>
          <div className="library-user">
            Open repository
            {liveCount > 0 ? ` · ${liveCount} live` : ""}
          </div>
        </div>
        <div className="library-actions">
          <Link href="/" className="ghost-btn">
            New map
          </Link>
        </div>
      </header>

      <section className="library-hero">
        <div className="library-hero-copy">
          <p className="eyebrow">Public forever store</p>
          <h1>Everything already found.</h1>
          <p>
            No login. Reopen any past map, search the whole graph, or launch a
            new swarm that keeps writing while you watch.
          </p>
        </div>
        <dl className="library-kpis">
          <div>
            <dt>Projects</dt>
            <dd>{data.stats.sessions}</dd>
          </div>
          <div>
            <dt>Entities</dt>
            <dd>{data.stats.entities}</dd>
          </div>
          <div>
            <dt>Links</dt>
            <dd>{data.stats.relations}</dd>
          </div>
          <div>
            <dt>Sources</dt>
            <dd>{data.stats.sources}</dd>
          </div>
        </dl>
      </section>

      {error && <div className="banner library-banner">{error}</div>}

      <div className="library-grid">
        <section className="library-panel launch-panel">
          <h2>Start mapping</h2>
          <p className="panel-sub">Name a company. Agents take it from there.</p>
          <form className="start-form" onSubmit={startResearch}>
            <label className="field">
              <span>Company</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="NVIDIA, Stripe, Siemens…"
                required
              />
            </label>
            <label className="field">
              <span>Mission</span>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={3}
                required
              />
            </label>
            <button type="submit" disabled={starting || !company.trim()}>
              {starting ? "Starting…" : "Start live map →"}
            </button>
          </form>
        </section>

        <section className="library-panel search-panel">
          <h2>Search everything</h2>
          <p className="panel-sub">Find any entity already saved.</p>
          <form className="repo-search-form" onSubmit={onSearch}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Companies, products, people…"
            />
            <button type="submit">Search</button>
          </form>
          <div className="library-results">
            {searchHits.length === 0 && q && (
              <p className="muted">No matches yet — try another term.</p>
            )}
            {searchHits.map((e) => (
              <Link
                key={e.id}
                href={e.sessionId ? `/workspace/${e.sessionId}` : "/library"}
                className="library-result"
              >
                <span className="rsi-type">{e.type}</span>
                <span className="rsi-name">{e.name}</span>
                <span className="rsi-sum">{e.summary}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="library-panel wide">
        <div className="panel-head-row">
          <div>
            <h2>Saved projects</h2>
            <p className="panel-sub">Tap any row to reopen the live desk.</p>
          </div>
        </div>
        <div className="project-list">
          {data.sessions.length === 0 && (
            <p className="empty-hint">
              No projects yet — start your first map above.
            </p>
          )}
          {data.sessions.map((s) => (
            <Link key={s.id} href={`/workspace/${s.id}`} className="project-row">
              <div>
                <div className="project-name">
                  {s.company}
                  {s.live && <span className="live-pill">Live</span>}
                </div>
                <div className="project-task">{s.task}</div>
              </div>
              <div className="project-meta">
                <span>{s.entityCount} entities</span>
                <span>{s.relationCount} links</span>
                <span>{s.sourceCount} sources</span>
                <span>{formatWhen(s.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="library-panel wide recent-panel">
        <h2>Recently written</h2>
        <p className="panel-sub">Latest entities landing in the forever store.</p>
        <div className="recent-grid">
          {data.recent.length === 0 && (
            <p className="empty-hint">Entities will stream in as agents write.</p>
          )}
          {data.recent.map((e) => (
            <Link
              key={e.id}
              href={`/workspace/${e.sessionId}`}
              className="recent-card"
            >
              <span className="rsi-type">{e.type}</span>
              <strong>{e.name}</strong>
              <p>{e.summary}</p>
              <em>{e.sources} sources</em>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
