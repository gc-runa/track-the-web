"use client";

import { FormEvent, useState } from "react";
import type { Entity } from "@/lib/types";

export function RepoSearch({
  sessionId,
  onSelect,
}: {
  sessionId: string;
  onSelect: (entity: Entity) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/research/search?q=${encodeURIComponent(q.trim())}&sessionId=${encodeURIComponent(sessionId)}`,
      );
      const data = await res.json();
      setResults((data.entities || []) as Entity[]);
      setMeta(`${data.count ?? 0} hits · ${data.source}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="repo-search">
      <form onSubmit={onSubmit} className="repo-search-form">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search forever repository…"
          aria-label="Search repository"
        />
        <button type="submit" disabled={busy}>
          {busy ? "…" : "SEARCH"}
        </button>
      </form>
      {meta && <div className="repo-search-meta">{meta}</div>}
      {results.length > 0 && (
        <div className="repo-search-results">
          {results.map((e) => (
            <button
              key={e.id}
              type="button"
              className="repo-search-item"
              onClick={() => onSelect(e)}
            >
              <span className="rsi-type">{e.type}</span>
              <span className="rsi-name">{e.name}</span>
              <span className="rsi-sum">{e.summary}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
