import {
  createHubspotObjectSyncRunResponseSchema,
  listHubspotObjectSyncRunsResponseSchema,
  type HubspotObjectSyncRun,
  type ListHubspotObjectSyncRunsResponse,
} from "@scouting-platform/contracts";

type ApiErrorBody = {
  error?: string;
};

export class HubspotObjectSyncApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HubspotObjectSyncApiError";
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
    return "You are not authorized to sync HubSpot objects.";
  }

  return "Unable to sync HubSpot objects.";
}

export async function fetchHubspotObjectSyncRuns(
  signal?: AbortSignal,
): Promise<ListHubspotObjectSyncRunsResponse> {
  const response = await fetch("/api/database/hubspot-sync", {
    method: "GET",
    cache: "no-store",
    signal: signal ?? null,
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new HubspotObjectSyncApiError(getApiErrorMessage(response, payload), response.status);
  }

  return listHubspotObjectSyncRunsResponseSchema.parse(payload);
}

export async function createHubspotObjectSyncRunRequest(): Promise<HubspotObjectSyncRun> {
  const response = await fetch("/api/database/hubspot-sync", {
    method: "POST",
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new HubspotObjectSyncApiError(getApiErrorMessage(response, payload), response.status);
  }

  return createHubspotObjectSyncRunResponseSchema.parse(payload).run;
}
