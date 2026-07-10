import { NextResponse } from "next/server";
import { ensureLiveSwarm } from "@/lib/swarm/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const { session, resumed } = await ensureLiveSwarm(body.sessionId);
    return NextResponse.json({
      ok: true,
      resumed,
      session: session.snapshot(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Resume failed" },
      { status: 400 },
    );
  }
}
