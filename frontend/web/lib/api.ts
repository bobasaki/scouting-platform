import { createHash, timingSafeEqual } from "node:crypto";

import { getSessionUserAccess, ServiceError } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { auth } from "../auth";

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap a JSON response with short-lived cache headers so the browser (and any
 * CDN) can reuse the response for `maxAge` seconds instead of re-fetching.
 *
 * `stale-while-revalidate` lets clients use a stale response while fetching a
 * fresh one in the background, preventing UI stalls on cache expiry.
 */
export function cachedJson(
  data: unknown,
  { maxAge = 30, swr = 60, status = 200 }: { maxAge?: number; swr?: number; status?: number } = {},
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

export function toRouteErrorResponse(error: unknown, context?: Record<string, unknown>): NextResponse {
  if (error instanceof ServiceError) {
    return jsonError(error.message, error.status);
  }

  // Unexpected error — log it so the generic 500 isn't silent in server logs.
  // Keep the client response generic to avoid leaking implementation details.
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error("[route-error]", {
    timestamp: new Date().toISOString(),
    message,
    stack,
    ...(context ?? {}),
  });

  return jsonError("Internal server error", 500);
}

type VerifiedSession = {
  userId: string;
  userEmail: string;
  role: "admin" | "user";
};

async function getVerifiedSession(): Promise<VerifiedSession | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const access = await getSessionUserAccess({
    userId,
    passwordChangedAt: session.user.passwordChangedAt ?? null,
    sessionIssuedAt: session.user.sessionIssuedAt ?? null,
  });

  if (!access) {
    return null;
  }

  return {
    userId: access.id,
    userEmail: access.email,
    role: access.role,
  };
}

export async function readJsonRequestBody(request: Request): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }
> {
  try {
    return {
      ok: true,
      body: await request.json(),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Invalid request payload", 400),
    };
  }
}

export async function requireAdminSession(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getVerifiedSession();

  if (!session) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  if (session.role !== "admin") {
    return { ok: false, response: jsonError("Forbidden", 403) };
  }

  return { ok: true, userId: session.userId };
}

/**
 * Constant-time string comparison. Both values are hashed to a fixed-length
 * digest first so the comparison never leaks the secret's length, and never
 * short-circuits on the first differing byte.
 */
function safeCompare(a: string, b: string): boolean {
  const aDigest = createHash("sha256").update(a).digest();
  const bDigest = createHash("sha256").update(b).digest();

  return timingSafeEqual(aDigest, bDigest);
}

/**
 * Authenticate a machine-to-machine request via a static bearer token.
 *
 * Used by external ingestion clients (e.g. the off-platform Wikidata scraper)
 * that cannot carry a browser session. The expected token comes from the
 * `INGEST_API_KEY` environment variable; a missing variable fails closed.
 */
export function requireIngestKey(request: Request):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  const expected = process.env.INGEST_API_KEY?.trim();

  if (!expected) {
    console.error("[ingest-auth] INGEST_API_KEY is not configured");
    return { ok: false, response: jsonError("Ingestion endpoint is not configured", 500) };
  }

  const header = request.headers.get("authorization")?.trim() ?? "";
  const provided = /^Bearer\s+(.+)$/iu.exec(header)?.[1]?.trim();

  if (!provided || !safeCompare(provided, expected)) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  return { ok: true };
}

export async function requireAuthenticatedSession(): Promise<
  | { ok: true; userId: string; userEmail: string; role: "admin" | "user" }
  | { ok: false; response: NextResponse }
> {
  const session = await getVerifiedSession();

  if (!session) {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }

  return {
    ok: true,
    userId: session.userId,
    userEmail: session.userEmail,
    role: session.role,
  };
}
