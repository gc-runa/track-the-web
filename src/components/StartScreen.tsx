"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSwarm } from "@/hooks/useSwarm";

type RecentSession = {
  id: string;
  company: string;
  entityCount: number;
  live: boolean;
};

export function StartScreen() {
  const router = useRouter();
  const { start } = useSwarm();
  const [company, setCompany] = useState("");
  const [task, setTask] = useState(
    "Map the full ecosystem — products, customers, suppliers, competitors, markets, people, debt, equity — with source-backed detail.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);

  useEffect(() => {
    void fetch("/api/library")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.sessions)) {
          setRecent(
            d.sessions.slice(0, 6).map(
              (s: {
                id: string;
                company: string;
                entityCount: number;
                live: boolean;
              }) => ({
                id: s.id,
                company: s.company,
                entityCount: s.entityCount,
                live: s.live,
              }),
            ),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await start(company.trim(), task.trim());
      router.push(`/workspace/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setLoading(false);
    }
  }

  return (
    <div className="start-shell start-poster">
      <div className="start-visual" aria-hidden>
        <div className="start-grid" />
        <div className="start-glow" />
        <div className="start-orbit" />
        <div className="start-orbit start-orbit-2" />
        <div className="start-nodes">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <svg className="start-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M22 30 L48 24 L62 48 L34 58 Z" />
          <path d="M48 24 L55 68" />
          <path d="M62 48 L78 36" />
        </svg>
      </div>

      <main className="start-main">
        <p className="brand-mark">Track the Web</p>
        <h1>Watch the world map itself.</h1>
        <p className="lede">
          Name a company. A parallel Hy3 swarm searches the open web, cites
          sources, and never stops writing the map.
        </p>

        <form className="start-form" onSubmit={onSubmit}>
          <label className="field">
            <span>Company</span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="NVIDIA, Stripe, Siemens…"
              required
              autoFocus
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
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading || !company.trim()}>
            {loading ? "Starting swarm…" : "Start live map →"}
          </button>
        </form>

        <div className="start-continue">
          <Link href="/library" className="secondary-cta">
            Browse everything already mapped
          </Link>
          {recent.length > 0 && (
            <ul className="start-recent">
              {recent.map((s) => (
                <li key={s.id}>
                  <Link href={`/workspace/${s.id}`}>
                    {s.company}
                    <em>
                      {s.live ? "live" : `${s.entityCount} entities`}
                    </em>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
