import {
  createAdminUserRequestSchema,
  adminUserResponseSchema,
  listAdminUsersResponseSchema,
} from "@scouting-platform/contracts";
import { createUser, listUsers } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { readJsonRequestBody, requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const users = await listUsers();
    const payload = listAdminUsersResponseSchema.parse({ users });
    return NextResponse.json(payload);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const rawBody = await readJsonRequestBody(request);

    if (!rawBody.ok) {
      return rawBody.response;
    }

    const parsedBody = createAdminUserRequestSchema.safeParse(rawBody.body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsedBody.error.flatten(),
        },
        { status: 400 },
      );
    }

    const user = await createUser({
      ...parsedBody.data,
      actorUserId: admin.userId,
    });
    const payload = adminUserResponseSchema.parse(user);

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
