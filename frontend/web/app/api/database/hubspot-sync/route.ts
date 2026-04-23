import {
  createHubspotObjectSyncRunResponseSchema,
  listHubspotObjectSyncRunsResponseSchema,
} from "@scouting-platform/contracts";
import {
  createHubspotObjectSyncRun,
  listHubspotObjectSyncRuns,
} from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const runs = await listHubspotObjectSyncRuns({
      requestedByUserId: admin.userId,
    });
    const payload = listHubspotObjectSyncRunsResponseSchema.parse(runs);

    return NextResponse.json(payload);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const run = await createHubspotObjectSyncRun({
      requestedByUserId: admin.userId,
    });
    const payload = createHubspotObjectSyncRunResponseSchema.parse({ run });

    return NextResponse.json(payload, { status: 202 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
