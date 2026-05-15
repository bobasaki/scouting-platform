import {
  clientSummarySchema,
  createClientRequestSchema,
  updateClientRequestSchema,
  type ClientSummary,
  type CreateClientRequest,
  type UpdateClientRequest,
} from "@scouting-platform/contracts";

type ApiErrorBody = {
  error?: string;
};

class ClientsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientsApiError";
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
    return "You are not authorized to manage clients.";
  }

  return "Unable to complete the request. Please try again.";
}

export async function createClientRequest(input: CreateClientRequest): Promise<ClientSummary> {
  const response = await fetch("/api/clients", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(createClientRequestSchema.parse(input)),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new ClientsApiError(getApiErrorMessage(response, payload), response.status);
  }

  return clientSummarySchema.parse(payload);
}

export async function updateClientRequest(
  clientId: string,
  input: UpdateClientRequest,
): Promise<ClientSummary> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(updateClientRequestSchema.parse(input)),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new ClientsApiError(getApiErrorMessage(response, payload), response.status);
  }

  return clientSummarySchema.parse(payload);
}

export async function deleteClientRequest(clientId: string): Promise<void> {
  const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new ClientsApiError(getApiErrorMessage(response, payload), response.status);
  }
}
