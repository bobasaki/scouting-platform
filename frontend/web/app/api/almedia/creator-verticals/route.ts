import {
  almediaCreatorVerticalOverrideInputSchema,
  almediaCreatorVerticalOverrideResponseSchema,
} from "@scouting-platform/contracts";
import { setAlmediaCreatorVerticalOverride } from "@scouting-platform/core";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";
import { ALMEDIA_CACHE_TAG } from "../../../../lib/cached-data";

export async function PUT(request: Request): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const body = almediaCreatorVerticalOverrideInputSchema.safeParse(rawBody);

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid creator vertical", details: body.error.flatten() },
        { status: 400 },
      );
    }

    const saved = await setAlmediaCreatorVerticalOverride({
      requestedByUserId: admin.userId,
      channelKey: body.data.channelKey,
      vertical: body.data.vertical,
    });

    revalidateTag(ALMEDIA_CACHE_TAG);

    return NextResponse.json(
      almediaCreatorVerticalOverrideResponseSchema.parse(saved),
    );
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "PUT /api/almedia/creator-verticals",
      userId: admin.userId,
    });
  }
}
