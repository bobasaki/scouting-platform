import {
  almediaAnalystChatRequestSchema,
  almediaAnalystStatusResponseSchema,
} from "@scouting-platform/contracts";
import {
  getAlmediaAnalystStatus,
  startAlmediaAnalystStream,
  type AlmediaAnalystStreamEvent,
} from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

/**
 * The AI analyst. GET reports whether the deployment can answer at all; POST
 * streams one answer back as Server-Sent Events.
 *
 * Neither response is cached: a status flip and a live token stream are both
 * things a shared cache would get wrong.
 */

/** Streaming needs the Node runtime; the Edge runtime cannot reach Prisma. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const status = await getAlmediaAnalystStatus(admin.userId);

    return NextResponse.json(almediaAnalystStatusResponseSchema.parse(status), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "GET /api/almedia/analyst",
      userId: admin.userId,
    });
  }
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Turn the service's event stream into an SSE body.
 *
 * Errors raised after the first byte cannot become an HTTP status, so they are
 * emitted as a final `error` frame — a truncated answer with no explanation is
 * worse than a short one that says why it stopped.
 */
function toSseResponse(
  events: AsyncIterable<AlmediaAnalystStreamEvent>,
  context: Record<string, unknown>,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          if (event.type === "delta") {
            controller.enqueue(encoder.encode(sseFrame("delta", { text: event.text })));
          } else if (event.type === "error") {
            controller.enqueue(
              encoder.encode(sseFrame("error", { error: event.message })),
            );
          } else {
            controller.enqueue(
              encoder.encode(sseFrame("done", { stopReason: event.stopReason })),
            );
          }
        }
      } catch (error) {
        console.error("[route-error]", {
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
          ...context,
        });
        controller.enqueue(
          encoder.encode(sseFrame("error", { error: "The AI request failed." })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Content-Type-Options": "nosniff",
      // Without this, a buffering reverse proxy holds the whole answer back.
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const body = almediaAnalystChatRequestSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid analyst request", details: body.error.flatten() },
        { status: 400 },
      );
    }

    // Aborting the fetch closes this signal, which cancels the upstream call
    // rather than leaving it generating tokens nobody will read.
    const events = await startAlmediaAnalystStream({
      requestedByUserId: admin.userId,
      messages: body.data.messages,
      context: body.data.context,
      signal: request.signal,
    });

    return toSseResponse(events, {
      route: "POST /api/almedia/analyst",
      userId: admin.userId,
    });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "POST /api/almedia/analyst",
      userId: admin.userId,
    });
  }
}
