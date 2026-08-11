import { almediaSyncResponseSchema } from "@scouting-platform/contracts";
import { requestAlmediaCampaignsSync } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

/**
 * Manual "Refresh" from the Almedia workspace. The provider call itself runs in
 * the worker, so this only records a durable sync run and enqueues the job.
 */
export async function POST(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const result = await requestAlmediaCampaignsSync({
      requestedByUserId: admin.userId,
    });

    return NextResponse.json(almediaSyncResponseSchema.parse(result), { status: 202 });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "POST /api/almedia/sync",
      userId: admin.userId,
    });
  }
}
