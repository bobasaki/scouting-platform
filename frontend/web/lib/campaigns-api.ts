import {
  campaignSummarySchema,
  createCampaignRequestSchema as createCampaignPayloadSchema,
  updateCampaignRequestSchema as updateCampaignPayloadSchema,
  type CampaignSummary,
  type CreateCampaignRequest,
  type UpdateCampaignRequest,
} from "@scouting-platform/contracts";

type ApiErrorBody = {
  error?: string;
};

class CampaignsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CampaignsApiError";
    this.status = status;
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(response: Response, payload: unknown): string {
  if (payload && typeof payload === "object" && typeof (payload as ApiErrorBody).error === "string") {
    return (payload as ApiErrorBody).error as string;
  }

  if (response.status === 401 || response.status === 403) {
    return "You are not authorized to manage campaigns.";
  }

  return "Unable to complete the request. Please try again.";
}

export async function createCampaignRequest(input: CreateCampaignRequest): Promise<CampaignSummary> {
  const response = await fetch("/api/campaigns", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(createCampaignPayloadSchema.parse(input)),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new CampaignsApiError(getApiErrorMessage(response, payload), response.status);
  }

  return campaignSummarySchema.parse(payload);
}

export async function updateCampaignRequest(
  campaignId: string,
  input: UpdateCampaignRequest,
): Promise<CampaignSummary> {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(updateCampaignPayloadSchema.parse(input)),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new CampaignsApiError(getApiErrorMessage(response, payload), response.status);
  }

  return campaignSummarySchema.parse(payload);
}

export async function deleteCampaignRequest(campaignId: string): Promise<void> {
  const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: "DELETE",
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new CampaignsApiError(getApiErrorMessage(response, payload), response.status);
  }
}
