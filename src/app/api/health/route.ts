import { NextResponse } from "next/server";
import { hasDatabase, getPool, ensureSchema } from "@/lib/db";
import { hasRedis, getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {
    service: "ok",
    database: "skipped",
    redis: "skipped",
  };

  if (hasDatabase()) {
    try {
      await ensureSchema();
      await getPool()!.query("SELECT 1");
      checks.database = "ok";
    } catch (err) {
      checks.database = err instanceof Error ? err.message : "error";
    }
  }

  if (hasRedis()) {
    try {
      const r = getRedis()!;
      if (r.status !== "ready") await r.connect();
      const pong = await r.ping();
      checks.redis = pong === "PONG" ? "ok" : "error";
    } catch (err) {
      checks.redis = err instanceof Error ? err.message : "error";
    }
  }

  const ok =
    checks.service === "ok" &&
    checks.database !== "error" &&
    !String(checks.database).toLowerCase().includes("fail") &&
    checks.redis !== "error";

  return NextResponse.json(
    {
      ok,
      service: "track-the-web",
      ts: Date.now(),
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
