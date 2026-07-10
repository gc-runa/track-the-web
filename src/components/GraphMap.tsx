"use client";

import { useMemo, useRef, useEffect } from "react";
import type { Entity, Relation } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  company: "#1f4b3a",
  supplier: "#3d6b58",
  customer: "#2a5f7a",
  competitor: "#8b3a2a",
  product: "#5a4a2a",
  market: "#3a4a6b",
  segment: "#4a5a3a",
  technology: "#4a3a6b",
  person: "#6b4a3a",
  location: "#2a5a4a",
  regulation: "#5a3a4a",
  partnership: "#3a5a6b",
  channel: "#5a5a2a",
  risk: "#7a2a2a",
  other: "#555555",
};

export function GraphMap({
  entities,
  relations,
  selectedId,
  onSelect,
}: {
  entities: Entity[];
  relations: Relation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positions = useRef(
    new Map<string, { x: number; y: number; vx: number; vy: number }>(),
  );

  const nodes = useMemo(() => {
    const companies = entities.filter((e) =>
      ["company", "competitor", "supplier", "customer"].includes(e.type),
    );
    const others = entities.filter(
      (e) => !["company", "competitor", "supplier", "customer"].includes(e.type),
    );
    // Prefer company graph; fill with related entities
    return [...companies, ...others].slice(0, 220);
  }, [entities]);
  const edges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return relations
      .filter((r) => ids.has(r.fromId) && ids.has(r.toId))
      .slice(0, 320);
  }, [nodes, relations]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    for (const n of nodes) {
      if (!positions.current.has(n.id)) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 40 + Math.random() * 180;
        positions.current.set(n.id, {
          x: canvas.clientWidth / 2 + Math.cos(angle) * radius,
          y: canvas.clientHeight / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        });
      }
    }

    const tick = () => {
      if (!running) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      for (const n of nodes) {
        const p = positions.current.get(n.id);
        if (!p) continue;
        p.vx += (cx - p.x) * 0.0008;
        p.vy += (cy - p.y) * 0.0008;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = positions.current.get(nodes[i].id)!;
          const b = positions.current.get(nodes[j].id)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.max(24, Math.hypot(dx, dy));
          const force = 420 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const e of edges) {
        const a = positions.current.get(e.fromId);
        const b = positions.current.get(e.toId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const force = (dist - 110) * 0.004;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }

      ctx.clearRect(0, 0, w, h);

      // soft paper grid
      ctx.strokeStyle = "rgba(40, 55, 45, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (const e of edges) {
        const a = positions.current.get(e.fromId);
        const b = positions.current.get(e.toId);
        if (!a || !b) continue;
        a.x += a.vx;
        a.y += a.vy;
        b.x += b.vx;
        b.y += b.vy;
        a.vx *= 0.86;
        a.vy *= 0.86;
        b.vx *= 0.86;
        b.vy *= 0.86;
        a.x = Math.min(w - 20, Math.max(20, a.x));
        a.y = Math.min(h - 20, Math.max(20, a.y));
        b.x = Math.min(w - 20, Math.max(20, b.x));
        b.y = Math.min(h - 20, Math.max(20, b.y));

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(40, 55, 45, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // integrate remaining nodes without edges
      for (const n of nodes) {
        const p = positions.current.get(n.id)!;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.x = Math.min(w - 20, Math.max(20, p.x));
        p.y = Math.min(h - 20, Math.max(20, p.y));
      }

      for (const n of nodes) {
        const p = positions.current.get(n.id)!;
        const selected = n.id === selectedId;
        const isCo = ["company", "competitor", "supplier", "customer"].includes(
          n.type,
        );
        const r = selected ? 11 : isCo ? 8 : 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = TYPE_COLOR[n.type] || "#555";
        ctx.fill();
        if (selected) {
          ctx.strokeStyle = "#e6b35a";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.fillStyle = isCo
          ? "rgba(230, 179, 90, 0.95)"
          : "rgba(215, 235, 224, 0.78)";
        ctx.font = selected || isCo
          ? "600 12px var(--font-sans), sans-serif"
          : "500 11px var(--font-sans), sans-serif";
        ctx.fillText(n.name.slice(0, 28), p.x + 10, p.y + 4);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      let best: { id: string; d: number } | null = null;
      for (const n of nodes) {
        const p = positions.current.get(n.id);
        if (!p) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 16 && (!best || d < best.d)) best = { id: n.id, d };
      }
      if (best) onSelect(best.id);
    };
    canvas.addEventListener("click", onClick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("click", onClick);
    };
  }, [nodes, edges, selectedId, onSelect]);

  return (
    <div className="graph-shell">
      <canvas ref={canvasRef} className="graph-canvas" />
      {nodes.length === 0 && (
        <div className="graph-empty">Map will appear as agents find entities…</div>
      )}
    </div>
  );
}
