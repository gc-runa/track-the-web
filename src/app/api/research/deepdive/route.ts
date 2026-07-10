import { NextResponse } from "next/server";
import { deepDiveEntity, ensureLiveSwarm } from "@/lib/swarm/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      entityId?: string;
      entityName?: string;
    };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const { session } = await ensureLiveSwarm(body.sessionId);

    let name = body.entityName?.trim();
    if (!name && body.entityId) {
      const ent = session
        .snapshot()
        .entities.find((e) => e.id === body.entityId);
      name = ent?.name;
    }
    if (!name) {
      return NextResponse.json({ error: "entity required" }, { status: 400 });
    }

    const result = deepDiveEntity(body.sessionId, name);
    return NextResponse.json({
      ok: true,
      ...result,
      session: session.snapshot(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deep dive failed" },
      { status: 500 },
    );
  }
}
