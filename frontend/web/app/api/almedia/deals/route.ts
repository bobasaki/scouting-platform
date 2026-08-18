import { almediaDealsResponseSchema } from "@scouting-platform/contracts";
import type { NextResponse } from "next/server";

import {
  cachedJson,
  requireAuthenticatedSession,
  toRouteErrorResponse,
} from "../../../../lib/api";
import { getCachedAlmediaDeals } from "../../../../lib/cached-data";

export async function GET(): Promise<NextResponse> {
  const session = await requireAuthenticatedSession();

  if (!session.ok) {
    return session.response;
  }

  try {
    const response = await getCachedAlmediaDeals();

    return cachedJson(almediaDealsResponseSchema.parse(response));
  } catch (error) {
    return toRouteErrorResponse(error, { route: "GET /api/almedia/deals" });
  }
}
