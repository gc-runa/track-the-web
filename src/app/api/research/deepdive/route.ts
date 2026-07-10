import { NextResponse } from "next/server";
import { deepDiveEntity } from "@/lib/swarm/orchestrator";
import { getSession } from "@/lib/knowledge/store";

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
    const session = getSession(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Live swarm not running — reopen a live map to deep dive." },
        { status: 404 },
      );
    }

    let name = body.entityName?.trim();
    if (!name && body.entityId) {
      const ent = session.snapshot().entities.find((e) => e.id === body.entityId);
      name = ent?.name;
    }
    if (!name) {
      return NextResponse.json({ error: "entity required" }, { status: 400 });
    }

    const result = deepDiveEntity(body.sessionId, name);
    return NextResponse.json({ ok: true, ...result, session: session.snapshot() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deep dive failed" },
      { status: 500 },
    );
  }
}
