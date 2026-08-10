import {
  almediaBookingResponseSchema,
  bookingUpdateInputSchema,
} from "@scouting-platform/contracts";
import { deleteBooking, updateBooking } from "@scouting-platform/core";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, toRouteErrorResponse } from "../../../../../lib/api";
import { ALMEDIA_CACHE_TAG } from "../../../../../lib/cached-data";

const paramsSchema = z.object({
  bookingId: z.uuid(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const body = bookingUpdateInputSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid booking payload", details: body.error.flatten() },
        { status: 400 },
      );
    }

    const booking = await updateBooking({
      requestedByUserId: admin.userId,
      bookingId: params.data.bookingId,
      booking: body.data,
    });

    revalidateTag(ALMEDIA_CACHE_TAG);

    return NextResponse.json(almediaBookingResponseSchema.parse({ booking }));
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "PATCH /api/almedia/bookings/[bookingId]",
      userId: admin.userId,
    });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookingId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    await deleteBooking({
      requestedByUserId: admin.userId,
      bookingId: params.data.bookingId,
    });

    revalidateTag(ALMEDIA_CACHE_TAG);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "DELETE /api/almedia/bookings/[bookingId]",
      userId: admin.userId,
    });
  }
}
