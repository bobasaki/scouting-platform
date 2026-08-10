import { almediaScorecardResponseSchema } from "@scouting-platform/contracts";
import type { NextResponse } from "next/server";

import { cachedJson, requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";
import { getCachedAlmediaScorecard } from "../../../../lib/cached-data";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const response = await getCachedAlmediaScorecard();

    return cachedJson(almediaScorecardResponseSchema.parse(response));
  } catch (error) {
    return toRouteErrorResponse(error, { route: "GET /api/almedia/scorecard" });
  }
}
