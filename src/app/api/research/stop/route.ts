import { NextResponse } from "next/server";
import { stopSwarm } from "@/lib/swarm/orchestrator";
import { getSession, listSessions } from "@/lib/knowledge/store";
import {
  markAllSessionsStopped,
  markSessionStopped,
  persistSessionMeta,
} from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    all?: boolean;
  };

  if (body.all) {
    for (const s of listSessions()) {
      stopSwarm(s.id);
    }
    const n = await markAllSessionsStopped().catch(() => 0);
    return NextResponse.json({ ok: true, stopped: n, scope: "all" });
  }

  if (!body.sessionId) {
    return NextResponse.json(
      { error: "sessionId required (or { all: true })" },
      { status: 400 },
    );
  }

  const session = getSession(body.sessionId);
  stopSwarm(body.sessionId);
  if (session) {
    const stats = session.getStats();
    await persistSessionMeta({
      id: session.id,
      company: session.company,
      task: session.task,
      stats: { ...stats, status: "stopped" },
      userId: session.userId,
    }).catch(() => undefined);
  }
  await markSessionStopped(body.sessionId).catch(() => undefined);
  return NextResponse.json({
    ok: true,
    status: "stopped",
    session: session?.snapshot() || null,
  });
}
