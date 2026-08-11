import { deleteBookingInvoice } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, toRouteErrorResponse } from "../../../../../lib/api";

const paramsSchema = z.object({
  invoiceId: z.uuid(),
});

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    await deleteBookingInvoice({
      requestedByUserId: admin.userId,
      invoiceId: params.data.invoiceId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error, {
      route: "DELETE /api/almedia/invoices/[invoiceId]",
      userId: admin.userId,
    });
  }
}
