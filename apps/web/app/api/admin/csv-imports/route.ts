import { csvImportBatchSummarySchema } from "@scouting-platform/contracts";
import { createCsvImportBatch } from "@scouting-platform/core";
import { NextResponse } from "next/server";

import { requireAdminSession, toRouteErrorResponse } from "../../../../lib/api";

const MAX_CSV_IMPORT_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await requireAdminSession();

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "CSV file must use the .csv extension" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "CSV file cannot be empty" }, { status: 400 });
    }

    if (file.size > MAX_CSV_IMPORT_BYTES) {
      return NextResponse.json({ error: "CSV file must be 5 MB or smaller" }, { status: 400 });
    }

    const csvText = await file.text();

    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV file cannot be empty" }, { status: 400 });
    }

    const batch = await createCsvImportBatch({
      requestedByUserId: admin.userId,
      filename: file.name,
      csvText,
    });
    const payload = csvImportBatchSummarySchema.parse(batch);

    return NextResponse.json(payload, { status: 202 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
