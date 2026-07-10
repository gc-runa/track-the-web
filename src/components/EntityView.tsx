"use client";

import type { Entity, Relation, Source } from "@/lib/types";

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return <p className="muted">No sources yet — still verifying.</p>;
  }
  return (
    <ul className="source-list">
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

export function EntityView({
  entity,
  relations,
  entities,
  onSelect,
}: {
  entity?: Entity;
  relations: Relation[];
  entities: Entity[];
  onSelect: (id: string) => void;
}) {
  if (!entity) {
    return (
      <div className="entity-empty">
        <h2>Select a page</h2>
        <p>Pick something from the library, map, or search.</p>
      </div>
    );
  }

  const byId = new Map(entities.map((e) => [e.id, e]));
  const linked = relations.filter(
    (r) => r.fromId === entity.id || r.toId === entity.id,
  );
  const records = entity.sourceRecords || [];

  return (
    <article className="entity-page">
      <div className="entity-kicker">{entity.type}</div>
      <h1 className="entity-title">{entity.name}</h1>
      <p className="entity-summary">{entity.summary}</p>

      <div className="entity-meta">
        <span>{(entity.confidence * 100).toFixed(0)}% confidence</span>
        <span>{records.length} sources</span>
        <span>Updated {new Date(entity.updatedAt).toLocaleTimeString()}</span>
      </div>

      {entity.tags.length > 0 && (
        <div className="tag-row">
          {entity.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      <section className="entity-section">
        <h3>Sources</h3>
        <SourceList sources={records} />
      </section>

      <section className="entity-section">
        <h3>Notes</h3>
        {entity.details.length === 0 ? (
          <p className="muted">More detail will land as agents expand this page.</p>
        ) : (
          <ul>
            {entity.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="entity-section">
        <h3>Connections</h3>
        {linked.length === 0 ? (
          <p className="muted">No links yet.</p>
        ) : (
          <ul className="link-list">
            {linked.map((r) => {
              const otherId = r.fromId === entity.id ? r.toId : r.fromId;
              const other = byId.get(otherId);
              if (!other) return null;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => onSelect(other.id)}>
                    <span className="link-label">{r.label}</span>
                    <span className="link-name">{other.name}</span>
                    <span className="link-type">{other.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}
