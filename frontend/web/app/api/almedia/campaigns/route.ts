import { almediaCampaignsResponseSchema } from "@scouting-platform/contracts";
import type { NextResponse } from "next/server";

import { cachedJson, requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";
import { getCachedAlmediaCampaigns } from "../../../../lib/cached-data";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const response = await getCachedAlmediaCampaigns();

    return cachedJson(almediaCampaignsResponseSchema.parse(response));
  } catch (error) {
    return toRouteErrorResponse(error, { route: "GET /api/almedia/campaigns" });
  }
}
