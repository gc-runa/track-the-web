import { ensureLiveSwarm } from "@/lib/swarm/orchestrator";
import type { SwarmEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return new Response("id required", { status: 400 });
  }

  let session;
  try {
    ({ session } = await ensureLiveSwarm(id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "session not found";
    return new Response(msg, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (
        event:
          | SwarmEvent
          | { type: "session"; session: ReturnType<typeof session.snapshot> },
      ) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      send({ type: "session", session: session.snapshot() });

      const onEvent = (event: SwarmEvent) => send(event);
      session.on("event", onEvent);

      const ping = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 12000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        session.off("event", onEvent);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
