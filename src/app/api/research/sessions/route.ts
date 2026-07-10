import { NextResponse } from "next/server";
import { listPersistedSessions } from "@/lib/persist";
import { listSessions } from "@/lib/knowledge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const memory = listSessions().map((s) => ({
    id: s.id,
    company: s.company,
    task: s.task,
    status: s.stats.status,
    entities: s.stats.entities,
    source: "memory" as const,
  }));

  const dbRows = await listPersistedSessions();
  const db = dbRows.map((r) => ({
    id: r.id as string,
    company: r.company as string,
    task: r.task as string,
    status: r.status as string,
    entities: (r.stats as { entities?: number } | null)?.entities ?? null,
    source: "postgres" as const,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({ memory, postgres: db });
}
