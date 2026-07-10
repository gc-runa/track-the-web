import { NextResponse } from "next/server";
import { startSwarm } from "@/lib/swarm/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { company?: string; task?: string };
    const company = body.company?.trim();
    const task = body.task?.trim();

    if (!company || !task) {
      return NextResponse.json(
        { error: "company and task are required" },
        { status: 400 },
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const session = startSwarm(company, task);
    return NextResponse.json({ session: session.snapshot() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start swarm" },
      { status: 500 },
    );
  }
}
