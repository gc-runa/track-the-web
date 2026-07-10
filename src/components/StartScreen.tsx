"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwarm } from "@/hooks/useSwarm";

export function StartScreen() {
  const router = useRouter();
  const { start } = useSwarm();
  const [company, setCompany] = useState("");
  const [task, setTask] = useState(
    "Build the deepest source-grounded map of the full ecosystem.",
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
    <div className="start-shell terminal-start">
      <div className="start-atmosphere" aria-hidden />
      <main className="start-main">
        <p className="brand-mark">Track the Web</p>
        <h1>Self-building world repository</h1>
        <p className="lede">
          Bloomberg-style terminal. Free web search + Hy3 agents sprawl forever:
          every new company gets a full dossier — products, customers, debt,
          equity, relationships — saved to Render Postgres.
        </p>

        <form className="start-form" onSubmit={onSubmit}>
          <label>
            Company
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Stripe, NVIDIA, Siemens"
              required
              autoFocus
            />
          </label>
          <label>
            Mission
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading || !company.trim()}>
            {loading ? "Opening terminal…" : "Open terminal & start swarm"}
          </button>
        </form>

        <p className="fineprint">
          OpenRouter · tencent/hy3:free · source-grounded · never idles
        </p>
      </main>
    </div>
  );
}
