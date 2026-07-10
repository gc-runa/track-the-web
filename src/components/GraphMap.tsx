"use client";

import { useMemo, useState } from "react";
import type { Entity, EntityType, Relation } from "@/lib/types";

type ClusterDef = {
  key: string;
  label: string;
  types: EntityType[];
  /** degrees from east, CSS-friendly */
  angle: number;
  color: string;
  limit: number;
};

const CLUSTERS: ClusterDef[] = [
  {
    key: "peers",
    label: "Peers",
    types: ["competitor"],
    angle: -90,
    color: "#ff6b5a",
    limit: 12,
  },
  {
    key: "holders",
    label: "Holders",
    types: ["company"],
    angle: -40,
    color: "#d4a24c",
    limit: 10,
  },
  {
    key: "people",
    label: "People",
    types: ["person"],
    angle: 10,
    color: "#e0a882",
    limit: 12,
  },
  {
    key: "products",
    label: "Products",
    types: ["product"],
    angle: 55,
    color: "#c4a574",
    limit: 10,
  },
  {
    key: "markets",
    label: "Markets",
    types: ["market", "segment"],
    angle: 100,
    color: "#7eb6d8",
    limit: 10,
  },
  {
    key: "risks",
    label: "Risks",
    types: ["regulation", "risk"],
    angle: 145,
    color: "#e07060",
    limit: 8,
  },
  {
    key: "partners",
    label: "Partners",
    types: ["partnership", "channel"],
    angle: 190,
    color: "#6bb3c4",
    limit: 10,
  },
  {
    key: "customers",
    label: "Customers",
    types: ["customer"],
    angle: 230,
    color: "#5eb8c8",
    limit: 12,
  },
  {
    key: "suppliers",
    label: "Suppliers",
    types: ["supplier"],
    angle: 280,
    color: "#3ecf8e",
    limit: 12,
  },
  {
    key: "tech",
    label: "Tech",
    types: ["technology"],
    angle: 325,
    color: "#9b8fd4",
    limit: 8,
  },
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

function isOwnerish(e: Entity, hubId: string, relations: Relation[]) {
  if (e.type !== "company") return false;
  return relations.some(
    (r) =>
      r.type === "owns" &&
      ((r.fromId === e.id && r.toId === hubId) ||
        (r.toId === e.id && r.fromId === hubId)),
  );
}

export function GraphMap({
  entities,
  relations,
  selectedId,
  rootCompany,
  onSelect,
  onDeepDive,
}: {
  entities: Entity[];
  relations: Relation[];
  selectedId?: string;
  rootCompany: string;
  onSelect: (id: string) => void;
  onDeepDive: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const hub = useMemo(() => {
    const exact = entities.find(
      (e) =>
        e.type === "company" &&
        e.name.toLowerCase() === rootCompany.trim().toLowerCase(),
    );
    return (
      exact ||
      entities.find((e) => e.type === "company") ||
      entities[0] ||
      null
    );
  }, [entities, rootCompany]);

  const clusters = useMemo(() => {
    if (!hub) return [];
    const used = new Set<string>([hub.id]);
    return CLUSTERS.map((c) => {
      let pool = entities.filter(
        (e) => c.types.includes(e.type) && !used.has(e.id),
      );
      if (c.key === "holders") {
        pool = entities.filter(
          (e) =>
            !used.has(e.id) &&
            (isOwnerish(e, hub.id, relations) ||
              /investor|holder|capital|fund|asset/i.test(
                `${e.name} ${e.tags.join(" ")} ${e.summary}`,
              )),
        );
      }
      // Prefer entities linked to hub
      const linked = new Set(
        relations
          .filter((r) => r.fromId === hub.id || r.toId === hub.id)
          .map((r) => (r.fromId === hub.id ? r.toId : r.fromId)),
      );
      pool = [...pool].sort((a, b) => {
        const al = linked.has(a.id) ? 1 : 0;
        const bl = linked.has(b.id) ? 1 : 0;
        if (al !== bl) return bl - al;
        return (b.confidence || 0) - (a.confidence || 0);
      });
      const total = pool.length;
      const showAll = expanded === c.key;
      const visible = pool.slice(0, showAll ? 40 : c.limit);
      for (const e of visible) used.add(e.id);
      return { ...c, items: visible, total };
    }).filter((c) => c.total > 0 || c.key === "peers" || c.key === "customers");
  }, [entities, relations, hub, expanded]);

  const W = 1200;
  const H = 780;
  const cx = W / 2;
  const cy = H / 2;
  const ring = Math.min(W, H) * 0.32;

  if (!hub) {
    return (
      <div className="rmap-shell">
        <div className="graph-empty">
          <h2>Relationship map forming</h2>
          <p>Hub and clusters appear as the swarm writes entities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rmap-shell">
      <div className="rmap-chrome">
        <span className="rmap-title">Relationship Map</span>
        <span className="rmap-hint">
          Click any node to deep dive · agents expand that dossier live
        </span>
      </div>

      <svg
        className="rmap-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Relationship map for ${hub.name}`}
      >
        <defs>
          <radialGradient id="rmapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(62,207,142,0.18)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#050505" />
        <circle cx={cx} cy={cy} r={ring + 80} fill="url(#rmapGlow)" />

        {/* spoke lines to cluster hubs */}
        {clusters.map((c) => {
          const p = polar(cx, cy, ring, c.angle);
          return (
            <line
              key={`spoke-${c.key}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke="rgba(180,190,185,0.22)"
              strokeWidth={1}
            />
          );
        })}

        {/* cluster nodes */}
        {clusters.map((c) => {
          const hubPos = polar(cx, cy, ring, c.angle);
          const n = Math.max(c.items.length, 1);
          return (
            <g key={c.key} className="rmap-cluster">
              <text
                x={hubPos.x}
                y={hubPos.y - 28}
                textAnchor="middle"
                className="rmap-cluster-label"
                fill={c.color}
              >
                {c.label} ({Math.min(c.items.length, c.limit)}/{c.total})
              </text>
              {c.items.map((item, i) => {
                const spread = Math.min(70, 12 + n * 4);
                const a =
                  c.angle +
                  (n === 1 ? 0 : ((i / (n - 1)) - 0.5) * spread);
                const r = ring + 56 + (i % 3) * 18;
                const pos = polar(cx, cy, r, a);
                const selected = item.id === selectedId;
                return (
                  <g
                    key={item.id}
                    className={`rmap-node ${selected ? "selected" : ""}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSelect(item.id)}
                    onDoubleClick={() => onDeepDive(item.id)}
                  >
                    <line
                      x1={hubPos.x}
                      y1={hubPos.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke="rgba(140,150,145,0.28)"
                      strokeWidth={0.8}
                    />
                    <rect
                      x={pos.x - 54}
                      y={pos.y - 12}
                      width={108}
                      height={24}
                      rx={3}
                      fill={selected ? "rgba(212,162,76,0.22)" : "#0c0c0c"}
                      stroke={selected ? "#d4a24c" : c.color}
                      strokeWidth={selected ? 1.6 : 1}
                    />
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill={selected ? "#f0d9a0" : "#e8f2ec"}
                      fontSize={10}
                      fontFamily="var(--font-mono), monospace"
                    >
                      {item.name.length > 16
                        ? `${item.name.slice(0, 15)}…`
                        : item.name}
                    </text>
                  </g>
                );
              })}
              {c.total > c.limit && (
                <g
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setExpanded((v) => (v === c.key ? null : c.key))
                  }
                >
                  <rect
                    x={hubPos.x - 28}
                    y={hubPos.y + 8}
                    width={56}
                    height={18}
                    rx={2}
                    fill="#111"
                    stroke={c.color}
                    strokeWidth={1}
                  />
                  <text
                    x={hubPos.x}
                    y={hubPos.y + 21}
                    textAnchor="middle"
                    fill={c.color}
                    fontSize={9}
                    fontFamily="var(--font-mono), monospace"
                  >
                    {expanded === c.key ? "Less" : "More…"}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* center hub */}
        <g
          className="rmap-hub"
          style={{ cursor: "pointer" }}
          onClick={() => onSelect(hub.id)}
          onDoubleClick={() => onDeepDive(hub.id)}
        >
          <rect
            x={cx - 110}
            y={cy - 36}
            width={220}
            height={72}
            rx={4}
            fill="#07140f"
            stroke="#3ecf8e"
            strokeWidth={2}
          />
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fill="#3ecf8e"
            fontSize={11}
            fontFamily="var(--font-mono), monospace"
            letterSpacing="0.06em"
          >
            {hub.type.toUpperCase()}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            fill="#f2f7f4"
            fontSize={16}
            fontWeight={700}
            fontFamily="var(--font-sans), sans-serif"
          >
            {hub.name.length > 26 ? `${hub.name.slice(0, 25)}…` : hub.name}
          </text>
          <text
            x={cx}
            y={cy + 28}
            textAnchor="middle"
            fill="#8fa399"
            fontSize={10}
            fontFamily="var(--font-mono), monospace"
          >
            {(hub.confidence * 100).toFixed(0)}% conf ·{" "}
            {hub.sourceRecords?.length || 0} src · click to dive
          </text>
        </g>
      </svg>

      <div className="rmap-legend">
        {CLUSTERS.map((c) => (
          <span key={c.key} style={{ color: c.color }}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
