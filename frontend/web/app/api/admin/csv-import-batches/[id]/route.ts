import {
  csvImportBatchDetailSchema,
  getCsvImportBatchDetailQuerySchema,
} from "@scouting-platform/contracts";
import { getCsvImportBatchById } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession, toRouteErrorResponse } from "../../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function GET(
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
      return NextResponse.json({ error: "Invalid csv import batch id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const parsedQuery = getCsvImportBatchDetailQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: parsedQuery.error.flatten(),
        },
        { status: 400 },
      );
    }

    const batch = await getCsvImportBatchById({
      importBatchId: params.data.id,
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
    });
    const payload = csvImportBatchDetailSchema.parse(batch);

    return NextResponse.json(payload);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
