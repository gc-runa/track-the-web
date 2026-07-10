import { NextResponse } from "next/server";
import { stopSwarm } from "@/lib/swarm/orchestrator";
import { getSession } from "@/lib/knowledge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const session = getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  stopSwarm(body.sessionId);
  return NextResponse.json({ session: session.snapshot() });
}
