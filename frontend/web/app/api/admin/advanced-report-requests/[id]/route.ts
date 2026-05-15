import { advancedReportApprovalsRetiredResponse } from "../../../_retired";

export async function GET(request: Request): Promise<Response> {
  void request;

  return advancedReportApprovalsRetiredResponse();
}
