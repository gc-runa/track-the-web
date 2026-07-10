import { NextResponse } from "next/server";
import { getSession } from "@/lib/knowledge/store";
import { loadSessionFromDb } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const live = getSession(id);
  if (live) {
    return NextResponse.json({ session: live.snapshot(), source: "memory" });
  }

  const persisted = await loadSessionFromDb(id);
  if (persisted) {
    return NextResponse.json({ session: persisted, source: "postgres" });
  }

  return NextResponse.json({ error: "session not found" }, { status: 404 });
}
