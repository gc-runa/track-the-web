"use client";

import type { Entity, EntityType } from "@/lib/types";

const TYPE_ORDER: EntityType[] = [
  "company",
  "competitor",
  "customer",
  "supplier",
  "product",
  "market",
  "segment",
  "technology",
  "person",
  "partnership",
  "channel",
  "location",
  "regulation",
  "risk",
  "other",
];

export function Sidebar({
  entities,
  selectedId,
  onSelect,
  view,
  onViewChange,
}: {
  entities: Entity[];
  selectedId?: string;
  onSelect: (id: string) => void;
  view: "map" | "page";
  onViewChange: (v: "map" | "page") => void;
}) {
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: entities.filter((e) => e.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="side-panel terminal-side">
      <div className="panel-head terminal-head">
        <h2>REPO</h2>
        <span>{entities.length}</span>
      </div>

      <div className="view-toggle">
        <button
          type="button"
          className={view === "map" ? "active" : ""}
          onClick={() => onViewChange("map")}
        >
          MAP
        </button>
        <button
          type="button"
          className={view === "page" ? "active" : ""}
          onClick={() => onViewChange("page")}
        >
          PAGE
        </button>
      </div>

      <div className="side-scroll">
        {grouped.length === 0 && (
          <p className="muted pad">Repository empty — agents writing…</p>
        )}
        {grouped.map((group) => (
          <div key={group.type} className="side-group">
            <div className="side-group-title">
              {group.type}
              <span>{group.items.length}</span>
            </div>
            {group.items.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`side-item ${selectedId === e.id ? "active" : ""}`}
                onClick={() => {
                  onSelect(e.id);
                  onViewChange("page");
                }}
              >
                <span className="side-item-name">{e.name}</span>
                <span className="side-item-sum">
                  {(e.sourceRecords?.length ?? 0) > 0
                    ? `${e.sourceRecords.length} src · ${e.summary}`
                    : e.summary}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
