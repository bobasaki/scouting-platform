import { csvImportBatchDetailSchema } from "@scouting-platform/contracts";
import { getCsvImportBatchById } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, toRouteErrorResponse } from "../../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid CSV import batch id" }, { status: 400 });
    }

    const batch = await getCsvImportBatchById(params.data.id);

    if (!batch) {
      return NextResponse.json({ error: "CSV import batch not found" }, { status: 404 });
    }

    const payload = csvImportBatchDetailSchema.parse(batch);
    return NextResponse.json(payload);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
