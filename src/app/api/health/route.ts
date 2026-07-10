import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Render free-tier health + keep-alive probe */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "track-the-web",
    ts: Date.now(),
  });
}
