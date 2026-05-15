import { NextResponse } from "next/server";

const ADVANCED_REPORT_REQUESTS_RETIRED_MESSAGE =
  "Advanced report requests are retired from the active product surface.";
const ADVANCED_REPORT_APPROVALS_RETIRED_MESSAGE =
  "Advanced report approvals are retired from the active product surface.";

function retiredAdvancedReportResponse(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 410 });
}

export function advancedReportRequestsRetiredResponse(): NextResponse {
  return retiredAdvancedReportResponse(ADVANCED_REPORT_REQUESTS_RETIRED_MESSAGE);
}

export function advancedReportApprovalsRetiredResponse(): NextResponse {
  return retiredAdvancedReportResponse(ADVANCED_REPORT_APPROVALS_RETIRED_MESSAGE);
}
