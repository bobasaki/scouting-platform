import type { AlmediaAnalystMessage } from "@scouting-platform/contracts";
import {
  getAlmediaAnalystModel,
  isAlmediaAnalystConfigured,
  streamAlmediaAnalystAnswer,
  type AlmediaAnalystStreamEvent,
} from "@scouting-platform/integrations";

import { recordAuditEvent } from "../audit";
import { ServiceError } from "../errors";
import { requireAlmediaAdminUser } from "./access";

/**
 * The AI analyst service. Everything analytical already happens client-side —
 * the digest the caller passes is built from the deal set the browser holds —
 * so this layer exists for the two things the browser must not do: hold the
 * OpenAI key, and decide who is allowed to ask.
 */

export type { AlmediaAnalystStreamEvent };

export interface AlmediaAnalystStatus {
  configured: boolean;
  model: string;
}

export async function getAlmediaAnalystStatus(
  requestedByUserId: string,
): Promise<AlmediaAnalystStatus> {
  await requireAlmediaAdminUser(requestedByUserId);

  return {
    configured: isAlmediaAnalystConfigured(),
    model: getAlmediaAnalystModel(),
  };
}

export interface StartAlmediaAnalystStreamInput {
  requestedByUserId: string;
  messages: readonly AlmediaAnalystMessage[];
  context: string;
  signal?: AbortSignal | undefined;
}

/**
 * Authorize, validate, audit, then hand back the event stream.
 *
 * Everything that can fail up front is checked here rather than inside the
 * generator: an async generator runs no code until its first `next()`, and by
 * then the route has already committed a 200 with an SSE body, so a rejection
 * would reach the user as a broken stream instead of an HTTP status.
 */
export async function startAlmediaAnalystStream(
  input: StartAlmediaAnalystStreamInput,
): Promise<AsyncIterable<AlmediaAnalystStreamEvent>> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  if (!isAlmediaAnalystConfigured()) {
    throw new ServiceError(
      "ALMEDIA_ANALYST_NOT_CONFIGURED",
      503,
      "The AI analyst is not configured. Set OPENAI_API_KEY on the web server.",
    );
  }

  const latest = input.messages[input.messages.length - 1];

  if (latest?.role !== "user") {
    throw new ServiceError(
      "ALMEDIA_ANALYST_INVALID_TURN",
      400,
      "The latest chat message must be from the user",
    );
  }

  // The question itself is not stored — it can carry campaign figures, and the
  // audit log is read far more widely than the workspace it came from.
  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.analyst.asked",
    entityType: "almedia_analyst",
    entityId: input.requestedByUserId,
    metadata: {
      model: getAlmediaAnalystModel(),
      turns: input.messages.length,
      questionChars: latest.content.length,
      contextChars: input.context.length,
    },
  });

  return streamAlmediaAnalystAnswer({
    messages: input.messages,
    context: input.context,
    signal: input.signal,
  });
}
