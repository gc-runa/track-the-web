"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwarm } from "@/hooks/useSwarm";

export function StartScreen() {
  const router = useRouter();
  const { start } = useSwarm();
  const [company, setCompany] = useState("");
  const [task, setTask] = useState(
    "Map the full ecosystem with source-backed detail.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="start-shell">
      <div className="start-visual" aria-hidden>
        <div className="start-grid" />
        <div className="start-glow" />
        <div className="start-orbit" />
      </div>

      <main className="start-main">
        <p className="brand-mark">Track the Web</p>
        <h1>Watch the world map itself.</h1>
        <p className="lede">
          Enter a company. Agents search, cite sources, and build a living map —
          forever.
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
            {loading ? "Starting…" : "Start mapping"}
          </button>
        </form>
      </main>
    </div>
  );
}
