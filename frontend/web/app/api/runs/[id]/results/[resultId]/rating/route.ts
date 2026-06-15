import {
  updateRunResultRatingRequestSchema,
  updateRunResultRatingResponseSchema,
} from "@scouting-platform/contracts";
import { updateRunResultRating } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  readJsonRequestBody,
  requireAuthenticatedSession,
  toRouteErrorResponse,
} from "../../../../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
  resultId: z.uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; resultId: string }> },
): Promise<NextResponse> {
  const session = await requireAuthenticatedSession();

  if (!session.ok) {
    return session.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid run result id" }, { status: 400 });
    }

    const requestBody = await readJsonRequestBody(request);

    if (!requestBody.ok) {
      return requestBody.response;
    }

    const body = updateRunResultRatingRequestSchema.safeParse(requestBody.body);

    if (!body.success) {
      return NextResponse.json(
        {
          error: "Invalid rating payload",
          details: body.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await updateRunResultRating({
      runId: params.data.id,
      resultId: params.data.resultId,
      userId: session.userId,
      role: session.role,
      rating: body.data.rating,
    });

    return NextResponse.json(updateRunResultRatingResponseSchema.parse(result));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
