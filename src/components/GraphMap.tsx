"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Entity, EntityType, Relation } from "@/lib/types";

type ClusterDef = {
  key: string;
  label: string;
  types: EntityType[];
  angle: number;
  color: string;
  limit: number;
};

const CLUSTERS: ClusterDef[] = [
  { key: "peers", label: "Peers", types: ["competitor"], angle: -90, color: "#ff6b5a", limit: 14 },
  { key: "holders", label: "Holders", types: ["company"], angle: -40, color: "#d4a24c", limit: 10 },
  { key: "people", label: "People", types: ["person"], angle: 10, color: "#e0a882", limit: 12 },
  { key: "products", label: "Products", types: ["product"], angle: 55, color: "#c4a574", limit: 12 },
  { key: "markets", label: "Markets", types: ["market", "segment"], angle: 100, color: "#7eb6d8", limit: 10 },
  { key: "risks", label: "Risks", types: ["regulation", "risk"], angle: 145, color: "#e07060", limit: 8 },
  { key: "partners", label: "Partners", types: ["partnership", "channel"], angle: 190, color: "#6bb3c4", limit: 10 },
  { key: "customers", label: "Customers", types: ["customer"], angle: 230, color: "#5eb8c8", limit: 14 },
  { key: "suppliers", label: "Suppliers", types: ["supplier"], angle: 280, color: "#3ecf8e", limit: 14 },
  { key: "tech", label: "Tech", types: ["technology"], angle: 325, color: "#9b8fd4", limit: 8 },
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
  const [focusCluster, setFocusCluster] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{
    active: boolean;
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 900);
    return () => clearInterval(id);
  }, []);

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
      const visible = pool.slice(0, showAll ? 48 : c.limit);
      for (const e of visible) used.add(e.id);
      return { ...c, items: visible, total };
    }).filter((c) => c.total > 0);
  }, [entities, relations, hub, expanded]);

  const hoverEntity = hover
    ? entities.find((e) => e.id === hover.id)
    : undefined;

  const W = 1400;
  const H = 900;
  const cx = W / 2;
  const cy = H / 2;
  const ring = Math.min(W, H) * 0.3;
  const pulse = 1 + Math.sin(tick / 2) * 0.04;

  const onWheel = useCallback((e: ReactWheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.0012;
    setTransform((t) => ({
      ...t,
      k: Math.min(2.8, Math.max(0.45, t.k * (1 + delta))),
    }));
  }, []);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as Element).closest?.("[data-node]")) return;
    drag.current = {
      active: true,
      px: e.clientX,
      py: e.clientY,
      ox: transform.x,
      oy: transform.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current?.active) return;
    setTransform({
      ...transform,
      x: drag.current.ox + (e.clientX - drag.current.px),
      y: drag.current.oy + (e.clientY - drag.current.py),
      k: transform.k,
    });
  };

  const onPointerUp = () => {
    if (drag.current) drag.current.active = false;
  };

  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });

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
    <div className="rmap-shell" ref={shellRef}>
      <div className="rmap-chrome">
        <div className="rmap-chrome-left">
          <span className="rmap-title">Relationship Map</span>
          <span className="rmap-live-dot" aria-hidden />
          <span className="rmap-hint">
            Drag to pan · scroll to zoom · click to dive
          </span>
        </div>
        <div className="rmap-tools">
          <button type="button" onClick={() => setTransform((t) => ({ ...t, k: Math.min(2.8, t.k * 1.15) }))}>
            +
          </button>
          <button type="button" onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.45, t.k / 1.15) }))}>
            −
          </button>
          <button type="button" onClick={resetView}>
            Reset
          </button>
        </div>
      </div>

      <div className="rmap-filters">
        <button
          type="button"
          className={!focusCluster ? "on" : ""}
          onClick={() => setFocusCluster(null)}
        >
          All
        </button>
        {CLUSTERS.map((c) => {
          const count = clusters.find((x) => x.key === c.key)?.total || 0;
          if (!count) return null;
          return (
            <button
              key={c.key}
              type="button"
              className={focusCluster === c.key ? "on" : ""}
              style={{ ["--chip" as string]: c.color }}
              onClick={() =>
                setFocusCluster((v) => (v === c.key ? null : c.key))
              }
            >
              {c.label}
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      <div
        className="rmap-stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          className="rmap-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Relationship map for ${hub.name}`}
        >
          <defs>
            <radialGradient id="rmapGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(62,207,142,0.22)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
            <filter id="rmapSoft">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3ecf8e" floodOpacity="0.35" />
            </filter>
          </defs>
          <rect width={W} height={H} fill="#050505" />
          <g
            transform={`translate(${W / 2 + transform.x} ${H / 2 + transform.y}) scale(${transform.k}) translate(${-W / 2} ${-H / 2})`}
          >
            <circle cx={cx} cy={cy} r={(ring + 90) * pulse} fill="url(#rmapGlow)" />

            {clusters.map((c) => {
              const dim =
                focusCluster && focusCluster !== c.key ? 0.18 : 1;
              const hubPos = polar(cx, cy, ring, c.angle);
              const n = Math.max(c.items.length, 1);
              return (
                <g key={c.key} opacity={dim} className="rmap-cluster">
                  <line
                    x1={cx}
                    y1={cy}
                    x2={hubPos.x}
                    y2={hubPos.y}
                    stroke={c.color}
                    strokeOpacity={0.35}
                    strokeWidth={1.2}
                  />
                  <text
                    x={hubPos.x}
                    y={hubPos.y - 34}
                    textAnchor="middle"
                    className="rmap-cluster-label"
                    fill={c.color}
                  >
                    {c.label} ({Math.min(c.items.length, c.limit)}/{c.total})
                  </text>
                  {c.items.map((item, i) => {
                    const spread = Math.min(78, 14 + n * 4);
                    const a =
                      c.angle +
                      (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
                    const r = ring + 62 + (i % 3) * 22;
                    const pos = polar(cx, cy, r, a);
                    const selected = item.id === selectedId;
                    const hot = hover?.id === item.id;
                    return (
                      <g
                        key={item.id}
                        data-node="1"
                        className={`rmap-node ${selected ? "selected" : ""}`}
                        style={{ cursor: "pointer" }}
                        onPointerEnter={(e) => {
                          const rect = shellRef.current?.getBoundingClientRect();
                          setHover({
                            id: item.id,
                            x: e.clientX - (rect?.left || 0),
                            y: e.clientY - (rect?.top || 0),
                          });
                        }}
                        onPointerLeave={() => setHover(null)}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelect(item.id);
                        }}
                        onDoubleClick={(ev) => {
                          ev.stopPropagation();
                          onDeepDive(item.id);
                        }}
                      >
                        <line
                          x1={hubPos.x}
                          y1={hubPos.y}
                          x2={pos.x}
                          y2={pos.y}
                          stroke={c.color}
                          strokeOpacity={0.28}
                          strokeWidth={0.9}
                        />
                        <rect
                          x={pos.x - 58}
                          y={pos.y - 13}
                          width={116}
                          height={26}
                          rx={3}
                          fill={
                            selected || hot
                              ? "rgba(212,162,76,0.22)"
                              : "#0c0c0c"
                          }
                          stroke={selected ? "#ffb000" : c.color}
                          strokeWidth={selected || hot ? 1.8 : 1}
                          filter={selected ? "url(#rmapSoft)" : undefined}
                        />
                        <text
                          x={pos.x}
                          y={pos.y + 4}
                          textAnchor="middle"
                          fill={selected || hot ? "#ffe6a8" : "#e8f2ec"}
                          fontSize={10}
                          fontFamily="var(--font-mono), monospace"
                        >
                          {item.name.length > 17
                            ? `${item.name.slice(0, 16)}…`
                            : item.name}
                        </text>
                      </g>
                    );
                  })}
                  {c.total > c.limit && (
                    <g
                      data-node="1"
                      style={{ cursor: "pointer" }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setExpanded((v) => (v === c.key ? null : c.key));
                      }}
                    >
                      <rect
                        x={hubPos.x - 30}
                        y={hubPos.y + 10}
                        width={60}
                        height={18}
                        rx={2}
                        fill="#111"
                        stroke={c.color}
                      />
                      <text
                        x={hubPos.x}
                        y={hubPos.y + 23}
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

            <g
              data-node="1"
              className="rmap-hub"
              style={{ cursor: "pointer" }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelect(hub.id);
              }}
              onDoubleClick={(ev) => {
                ev.stopPropagation();
                onDeepDive(hub.id);
              }}
              onPointerEnter={(e) => {
                const rect = shellRef.current?.getBoundingClientRect();
                setHover({
                  id: hub.id,
                  x: e.clientX - (rect?.left || 0),
                  y: e.clientY - (rect?.top || 0),
                });
              }}
              onPointerLeave={() => setHover(null)}
            >
              <rect
                x={cx - 120}
                y={cy - 40}
                width={240}
                height={80}
                rx={4}
                fill="#07140f"
                stroke="#3ecf8e"
                strokeWidth={2.2}
                filter="url(#rmapSoft)"
                transform={`translate(${cx} ${cy}) scale(${pulse}) translate(${-cx} ${-cy})`}
              />
              <text
                x={cx}
                y={cy - 14}
                textAnchor="middle"
                fill="#3ecf8e"
                fontSize={11}
                fontFamily="var(--font-mono), monospace"
                letterSpacing="0.08em"
              >
                {hub.type.toUpperCase()}
              </text>
              <text
                x={cx}
                y={cy + 10}
                textAnchor="middle"
                fill="#f2f7f4"
                fontSize={18}
                fontWeight={700}
                fontFamily="var(--font-sans), sans-serif"
              >
                {hub.name.length > 28 ? `${hub.name.slice(0, 27)}…` : hub.name}
              </text>
              <text
                x={cx}
                y={cy + 30}
                textAnchor="middle"
                fill="#8fa399"
                fontSize={10}
                fontFamily="var(--font-mono), monospace"
              >
                {(hub.confidence * 100).toFixed(0)}% ·{" "}
                {hub.sourceRecords?.length || 0} src · click to dive
              </text>
            </g>
          </g>
        </svg>

        {hoverEntity && hover && (
          <div
            className="rmap-tooltip"
            style={{ left: hover.x + 14, top: hover.y + 14 }}
          >
            <div className="rmap-tip-type">{hoverEntity.type}</div>
            <strong>{hoverEntity.name}</strong>
            <p>{hoverEntity.summary || "No summary yet"}</p>
            <div className="rmap-tip-meta">
              {(hoverEntity.confidence * 100).toFixed(0)}% conf ·{" "}
              {hoverEntity.sourceRecords?.length || 0} sources
            </div>
            <div className="rmap-tip-actions">Click · deep dive</div>
          </div>
        )}
      </div>
    </div>
  );
}
