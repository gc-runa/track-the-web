import { NextResponse } from "next/server";
import {
  libraryStats,
  listPersistedSessions,
  recentEntities,
} from "@/lib/persist";
import { listSessions } from "@/lib/knowledge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, sessions, recent, live] = await Promise.all([
    libraryStats(),
    listPersistedSessions(),
    recentEntities(30),
    Promise.resolve(listSessions()),
  ]);

  const statsRow = stats as {
    sessions: number | string;
    entities: number | string;
    relations: number | string;
    sources: number | string;
  };

  return NextResponse.json({
    open: true,
    stats: {
      sessions: Number(statsRow.sessions) || 0,
      entities: Number(statsRow.entities) || 0,
      relations: Number(statsRow.relations) || 0,
      sources: Number(statsRow.sources) || 0,
    },
    sessions: sessions.map((s) => {
      const snap =
        typeof s.stats === "object" && s.stats
          ? (s.stats as {
              entities?: number;
              relations?: number;
              sources?: number;
            })
          : {};
      return {
        id: s.id,
        company: s.company,
        task: s.task,
        status: s.status,
        entityCount: Number(s.entity_count ?? snap.entities ?? 0) || 0,
        relationCount: Number(s.relation_count ?? snap.relations ?? 0) || 0,
        sourceCount: Number(s.source_count ?? snap.sources ?? 0) || 0,
        updatedAt: s.updated_at,
        createdAt: s.created_at,
        live: live.some((l) => l.id === s.id),
      };
    }),
    recent: recent.map((e) => ({
      id: e.id,
      sessionId: e.session_id,
      type: e.type,
      name: e.name,
      summary: e.summary,
      confidence: Number(e.confidence),
      sources: Array.isArray(e.source_records) ? e.source_records.length : 0,
      updatedAt: e.updated_at,
    })),
    live: live.map((s) => ({
      id: s.id,
      company: s.company,
      task: s.task,
      status: s.stats.status,
      entities: s.stats.entities,
      relations: s.stats.relations,
      sources: s.stats.sources,
    })),
  });
}
