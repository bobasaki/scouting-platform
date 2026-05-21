import {
  adminUserResponseSchema,
  updateAdminUserProfileRequestSchema,
} from "@scouting-platform/contracts";
import { updateUserProfile } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonRequestBody, requireAdminSession, toRouteErrorResponse } from "../../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const rawBody = await readJsonRequestBody(request);

    if (!rawBody.ok) {
      return rawBody.response;
    }

    const body = updateAdminUserProfileRequestSchema.safeParse(rawBody.body);

    if (!body.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: body.error.flatten(),
        },
        { status: 400 },
      );
    }

    const user = await updateUserProfile({
      userId: params.data.id,
      actorUserId: admin.userId,
      profile: body.data,
    });
    const payload = adminUserResponseSchema.parse(user);

    return NextResponse.json(payload);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
