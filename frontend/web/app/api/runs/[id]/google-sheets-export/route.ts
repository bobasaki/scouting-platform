import {
  exportRunToGoogleSheetsRequestSchema,
  exportRunToGoogleSheetsResponseSchema,
} from "@scouting-platform/contracts";
import { exportHubspotRunToGoogleSheets } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireAuthenticatedSession,
  toRouteErrorResponse,
} from "../../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAuthenticatedSession();

  if (!session.ok) {
    return session.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    }

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const body = exportRunToGoogleSheetsRequestSchema.safeParse(rawBody);

    if (!body.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: body.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await exportHubspotRunToGoogleSheets({
      runId: params.data.id,
      userId: session.userId,
      role: session.role,
      request: body.data,
    });

    return NextResponse.json(exportRunToGoogleSheetsResponseSchema.parse(result));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
