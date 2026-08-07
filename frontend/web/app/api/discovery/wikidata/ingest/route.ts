import {
  wikidataIngestRequestSchema,
  wikidataIngestResponseSchema,
} from "@scouting-platform/contracts";
import { ingestWikidataChannels } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import {
  readJsonRequestBody,
  requireIngestKey,
  toRouteErrorResponse,
} from "../../../../../lib/api";

/**
 * Ingestion endpoint for the off-platform Wikidata YouTube discovery scraper.
 *
 * Authenticated with a static bearer token (INGEST_API_KEY), not a session.
 * Accepts a batch of discovered channel seeds and upserts them; existing
 * enriched channel data is never overwritten. See ingestWikidataChannels.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authorized = requireIngestKey(request);

  if (!authorized.ok) {
    return authorized.response;
  }

  const parsedBody = await readJsonRequestBody(request);

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = wikidataIngestRequestSchema.safeParse(parsedBody.body);

  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid request payload", details: body.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await ingestWikidataChannels({ channels: body.data.channels });

    return NextResponse.json(wikidataIngestResponseSchema.parse(result), { status: 200 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
