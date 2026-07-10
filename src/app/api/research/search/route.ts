import { NextResponse } from "next/server";
import { getSession } from "@/lib/knowledge/store";
import { loadSessionFromDb } from "@/lib/persist";
import { getPool, hasDatabase, ensureSchema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const sessionId = searchParams.get("sessionId") || "";
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const needle = q.toLowerCase();

  // Prefer live memory
  if (sessionId) {
    const live = getSession(sessionId);
    if (live) {
      const snap = live.snapshot();
      const entities = snap.entities.filter(
        (e) =>
          e.name.toLowerCase().includes(needle) ||
          e.summary.toLowerCase().includes(needle) ||
          e.tags.some((t) => t.toLowerCase().includes(needle)) ||
          e.details.some((d) => d.toLowerCase().includes(needle)) ||
          e.sourceRecords.some(
            (s) =>
              s.title.toLowerCase().includes(needle) ||
              s.publisher.toLowerCase().includes(needle),
          ),
      );
      return NextResponse.json({
        q,
        source: "memory",
        count: entities.length,
        entities: entities.slice(0, 80),
      });
    }
  }

  if (hasDatabase()) {
    await ensureSchema();
    const p = getPool()!;
    const res = await p.query(
      `SELECT * FROM entities
       WHERE ($1::text = '' OR session_id = $1)
         AND (
           name ILIKE $2 OR summary ILIKE $2
           OR details::text ILIKE $2
           OR tags::text ILIKE $2
           OR source_records::text ILIKE $2
         )
       ORDER BY updated_at DESC
       LIMIT 80`,
      [sessionId || "", `%${q}%`],
    );
    return NextResponse.json({
      q,
      source: "postgres",
      count: res.rowCount,
      entities: res.rows.map((e) => ({
        id: e.id,
        type: e.type,
        name: e.name,
        summary: e.summary,
        details: e.details || [],
        tags: e.tags || [],
        confidence: Number(e.confidence),
        sources: e.sources || [],
        sourceRecords: e.source_records || [],
        createdAt: new Date(e.created_at).getTime(),
        updatedAt: new Date(e.updated_at).getTime(),
        agentId: e.agent_id,
        sessionId: e.session_id,
      })),
    });
  }

  // Fallback: try loading session from db into filter
  if (sessionId) {
    const persisted = await loadSessionFromDb(sessionId);
    if (persisted) {
      const entities = persisted.entities.filter(
        (e) =>
          e.name.toLowerCase().includes(needle) ||
          e.summary.toLowerCase().includes(needle),
      );
      return NextResponse.json({
        q,
        source: "postgres-session",
        count: entities.length,
        entities: entities.slice(0, 80),
      });
    }
  }

  return NextResponse.json({ q, source: "none", count: 0, entities: [] });
}
