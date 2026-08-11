import {
  almediaInvoiceResponseSchema,
  almediaInvoicesResponseSchema,
  bookingInvoiceInputSchema,
} from "@scouting-platform/contracts";
import { listBookingInvoices, upsertBookingInvoice } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

/**
 * Invoice snapshots are hand-recorded as bills go out, so like bookings they are
 * served uncached — an admin who just marked a campaign invoiced must see it on
 * the next poll. Nothing derived is cached off them either: the billing model is
 * recomputed client-side from the deal set on every load.
 */
export async function GET(): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const invoices = await listBookingInvoices();

    return NextResponse.json(almediaInvoicesResponseSchema.parse({ invoices }));
  } catch (error) {
    return toRouteErrorResponse(error, { route: "GET /api/almedia/invoices" });
  }
}

/**
 * Upsert rather than create: re-invoicing a campaign after it matures replaces
 * the snapshot with the figures the new bill was sent at, and the campaign name
 * is the natural key that makes that idempotent.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const body = bookingInvoiceInputSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        { error: "Invalid invoice payload", details: body.error.flatten() },
        { status: 400 },
      );
    }

    const invoice = await upsertBookingInvoice({
      requestedByUserId: admin.userId,
      invoice: body.data,
    });

    return NextResponse.json(almediaInvoiceResponseSchema.parse({ invoice }));
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "PUT /api/almedia/invoices",
      userId: admin.userId,
    });
  }
}
