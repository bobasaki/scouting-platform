import {
  almediaBookingResponseSchema,
  almediaBookingsResponseSchema,
  bookingInputSchema,
} from "@scouting-platform/contracts";
import { createBooking, listBookings } from "@scouting-platform/core";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";
import { ALMEDIA_CACHE_TAG } from "../../../../lib/cached-data";

/**
 * The booking tracker is hand-maintained, so this list is served uncached — an
 * admin who just saved a row must see it on the next poll, not 30 seconds later.
 */
export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const bookings = await listBookings();

    return NextResponse.json(almediaBookingsResponseSchema.parse({ bookings }));
  } catch (error) {
    return toRouteErrorResponse(error, { route: "GET /api/almedia/bookings" });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const body = bookingInputSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid booking payload", details: body.error.flatten() },
        { status: 400 },
      );
    }

    const booking = await createBooking({
      requestedByUserId: admin.userId,
      booking: body.data,
    });

    // Deals and the scorecard are both derived from bookings.
    revalidateTag(ALMEDIA_CACHE_TAG);

    return NextResponse.json(almediaBookingResponseSchema.parse({ booking }), {
      status: 201,
    });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "POST /api/almedia/bookings",
      userId: admin.userId,
    });
  }
}
