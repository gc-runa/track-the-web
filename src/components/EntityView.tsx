"use client";

import { useMemo, useState } from "react";
import type { Entity, Relation, Source } from "@/lib/types";

type DiveTab =
  | "overview"
  | "relations"
  | "notes"
  | "sources"
  | "structure";

const TABS: Array<{ id: DiveTab; num: string; label: string }> = [
  { id: "overview", num: "1", label: "Key Stats" },
  { id: "relations", num: "2", label: "Relations" },
  { id: "notes", num: "3", label: "Notes / FA" },
  { id: "sources", num: "4", label: "Sources" },
  { id: "structure", num: "5", label: "Structure" },
];

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return <p className="muted">No sources yet — agents still verifying.</p>;
  }
  return (
    <ul className="source-list bb-source-list">
      {sources.map((s) => (
        <li key={s.id} className={`source-item kind-${s.kind}`}>
          <div className="source-top">
            <span className="source-kind">{s.kind.replace(/_/g, " ")}</span>
            <span className="source-conf">
              {(s.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="source-title">{s.title}</div>
          <div className="source-pub">{s.publisher}</div>
          <p className="source-excerpt">{s.excerpt}</p>
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="source-url"
            >
              Open source
            </a>
          ) : (
            <span className="source-nourl">No URL provided</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bb-row">
      <span className="bb-row-label">{label}</span>
      <span className="bb-row-value">{value}</span>
    </div>
  );
}

export function EntityView({
  entity,
  relations,
  entities,
  diving,
  onSelect,
  onDeepDive,
}: {
  entity?: Entity;
  relations: Relation[];
  entities: Entity[];
  diving?: boolean;
  onSelect: (id: string) => void;
  onDeepDive: (id: string) => void;
}) {
  const [tab, setTab] = useState<DiveTab>("overview");

  const byId = useMemo(
    () => new Map(entities.map((e) => [e.id, e])),
    [entities],
  );

  const linked = useMemo(() => {
    if (!entity) return [];
    return relations.filter(
      (r) => r.fromId === entity.id || r.toId === entity.id,
    );
  }, [entity, relations]);

  const byType = useMemo(() => {
    const groups = new Map<string, Entity[]>();
    for (const r of linked) {
      if (!entity) continue;
      const otherId = r.fromId === entity.id ? r.toId : r.fromId;
      const other = byId.get(otherId);
      if (!other) continue;
      const list = groups.get(other.type) || [];
      if (!list.some((e) => e.id === other.id)) list.push(other);
      groups.set(other.type, list);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [linked, byId, entity]);

  if (!entity) {
    return (
      <div className="entity-empty">
        <h2>Select a node</h2>
        <p>Click anything on the relationship map to open a deep dive.</p>
      </div>
    );
  }

  const records = entity.sourceRecords || [];
  const financialish = entity.details.filter((d) =>
    /\$|revenue|debt|equity|margin|ebitda|cash|billion|million|%|fy\s?\d/i.test(
      d,
    ),
  );

  return (
    <article className="bb-desk">
      <header className="bb-ticker">
        <div className="bb-ticker-main">
          <span className="bb-sym">{entity.type.toUpperCase()}</span>
          <h1>{entity.name}</h1>
          <span className="bb-chg ok">
            {(entity.confidence * 100).toFixed(0)}% conf
          </span>
        </div>
        <div className="bb-ticker-actions">
          <button
            type="button"
            className="bb-action dive"
            disabled={diving}
            onClick={() => onDeepDive(entity.id)}
          >
            {diving ? "Spawning…" : "96) Deep Dive"}
          </button>
        </div>
      </header>

      <div className="bb-subhead">
        <span>{entity.summary.slice(0, 140) || "Awaiting summary"}</span>
        <span className="bb-meta-bits">
          {records.length} sources · updated{" "}
          {new Date(entity.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      <nav className="bb-tabs" aria-label="Deep dive sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <em>{t.num})</em> {t.label}
          </button>
        ))}
      </nav>

      <div className="bb-body">
        {tab === "overview" && (
          <div className="bb-grid-pane">
            <section className="bb-panel">
              <h3>Adj Highlights</h3>
              <MetricRow label="Entity type" value={entity.type} />
              <MetricRow
                label="Confidence"
                value={`${(entity.confidence * 100).toFixed(0)}%`}
              />
              <MetricRow label="Sources" value={String(records.length)} />
              <MetricRow label="Links" value={String(linked.length)} />
              <MetricRow
                label="Tags"
                value={entity.tags.slice(0, 6).join(", ") || "—"}
              />
            </section>
            <section className="bb-panel">
              <h3>Claim</h3>
              <p className="bb-claim">{entity.summary}</p>
              {financialish.length > 0 && (
                <>
                  <h3 className="bb-sub">Financial signals</h3>
                  <ul className="bb-fa-list">
                    {financialish.slice(0, 12).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="bb-panel wide">
              <h3>Related clusters</h3>
              <div className="bb-cluster-grid">
                {byType.length === 0 && (
                  <p className="muted">
                    No links yet — hit Deep Dive to spawn specialist agents.
                  </p>
                )}
                {byType.map(([type, list]) => (
                  <div key={type} className="bb-cluster">
                    <header>
                      {type} ({list.length})
                    </header>
                    <ul>
                      {list.slice(0, 8).map((e) => (
                        <li key={e.id}>
                          <button type="button" onClick={() => onSelect(e.id)}>
                            {e.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "relations" && (
          <div className="bb-panel full">
            <h3>Relationship tape</h3>
            {linked.length === 0 ? (
              <p className="muted">No relations yet.</p>
            ) : (
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Edge</th>
                    <th>Counterparty</th>
                    <th>Type</th>
                    <th>Conf</th>
                  </tr>
                </thead>
                <tbody>
                  {linked.map((r) => {
                    const otherId =
                      r.fromId === entity.id ? r.toId : r.fromId;
                    const other = byId.get(otherId);
                    if (!other) return null;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => onSelect(other.id)}
                        className="clickable"
                      >
                        <td>{r.label || r.type}</td>
                        <td className="amber">{other.name}</td>
                        <td>{other.type}</td>
                        <td>{((r.confidence || 0) * 100).toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "notes" && (
          <div className="bb-panel full">
            <h3>Notes / Financial Analysis</h3>
            {entity.details.length === 0 ? (
              <p className="muted">
                Detail lines land as agents expand this dossier.
              </p>
            ) : (
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fact</th>
                  </tr>
                </thead>
                <tbody>
                  {entity.details.map((d, i) => (
                    <tr key={`${i}-${d.slice(0, 24)}`}>
                      <td className="dim">{i + 1}</td>
                      <td className="amber">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "sources" && (
          <div className="bb-panel full">
            <h3>Grounded sources</h3>
            <SourceList sources={records} />
          </div>
        )}

        {tab === "structure" && (
          <div className="bb-panel full">
            <h3>Corporate / ecosystem structure</h3>
            <p className="bb-tree-hint">
              Click any child to deep dive that node.
            </p>
            <ul className="bb-tree">
              <li className="bb-tree-root">
                <button type="button" onClick={() => onDeepDive(entity.id)}>
                  − {entity.name}
                </button>
                <ul>
                  {byType.map(([type, list]) => (
                    <li key={type}>
                      <span className="bb-tree-branch">{type}</span>
                      <ul>
                        {list.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() => onSelect(e.id)}
                              onDoubleClick={() => onDeepDive(e.id)}
                            >
                              {e.name}
                              <em>{e.type}</em>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
