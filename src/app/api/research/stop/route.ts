import { NextResponse } from "next/server";
import { stopSwarm } from "@/lib/swarm/orchestrator";
import { getSession } from "@/lib/knowledge/store";
import { persistSessionMeta } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
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
    return NextResponse.json({ session: session.snapshot() });
  }
  return NextResponse.json({ ok: true, status: "stopped" });
}
