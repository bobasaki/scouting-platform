import {
  almediaCampaignsResponseSchema,
  almediaDealsResponseSchema,
  almediaScorecardResponseSchema,
  almediaSyncResponseSchema,
  type AlmediaCampaignsResponse,
  type AlmediaDealsResponse,
  type AlmediaScorecardResponse,
  type AlmediaSyncResponse,
} from "@scouting-platform/contracts";
import type { ZodType } from "zod";

const GENERIC_REQUEST_ERROR_MESSAGE = "Unable to complete the request. Please try again.";
const UNAUTHORIZED_ERROR_MESSAGE = "You are not authorized to view Almedia tracking.";

type ApiErrorBody = {
  error?: string;
};

export class AlmediaApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AlmediaApiRequestError";
    this.status = status;
  }
}

function normalizeErrorMessage(
  error: unknown,
  fallbackMessage = GENERIC_REQUEST_ERROR_MESSAGE,
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(response: Response, payload: unknown): string {
  if (payload && typeof payload === "object") {
    const maybeErrorPayload = payload as ApiErrorBody;

    if (
      typeof maybeErrorPayload.error === "string" &&
      maybeErrorPayload.error.trim().length > 0
    ) {
      return maybeErrorPayload.error;
    }
  }

  if (response.status === 401 || response.status === 403) {
    return UNAUTHORIZED_ERROR_MESSAGE;
  }

  return GENERIC_REQUEST_ERROR_MESSAGE;
}

function normalizeRequestError(
  error: unknown,
  fallbackMessage = GENERIC_REQUEST_ERROR_MESSAGE,
): Error {
  if (error instanceof AlmediaApiRequestError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return error;
  }

  return new Error(normalizeErrorMessage(error, fallbackMessage));
}

async function requestJson<T>(
  path: string,
  schema: ZodType<T>,
  invalidResponseMessage: string,
  init: Readonly<{ method?: "GET" | "POST"; signal?: AbortSignal | undefined }> = {},
): Promise<T> {
  try {
    const response = await fetch(path, {
      method: init.method ?? "GET",
      cache: "no-store",
      signal: init.signal ?? null,
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      throw new AlmediaApiRequestError(
        getApiErrorMessage(response, payload),
        response.status,
      );
    }

    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(invalidResponseMessage);
    }

    return parsed.data;
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

export async function fetchAlmediaDeals(
  signal?: AbortSignal,
): Promise<AlmediaDealsResponse> {
  return requestJson(
    "/api/almedia/deals",
    almediaDealsResponseSchema,
    "Received an invalid Almedia deals response.",
    { signal },
  );
}

export async function fetchAlmediaCampaigns(
  signal?: AbortSignal,
): Promise<AlmediaCampaignsResponse> {
  return requestJson(
    "/api/almedia/campaigns",
    almediaCampaignsResponseSchema,
    "Received an invalid Almedia campaigns response.",
    { signal },
  );
}

export async function fetchAlmediaScorecard(
  signal?: AbortSignal,
): Promise<AlmediaScorecardResponse> {
  return requestJson(
    "/api/almedia/scorecard",
    almediaScorecardResponseSchema,
    "Received an invalid Almedia scorecard response.",
    { signal },
  );
}

export async function requestAlmediaSync(
  signal?: AbortSignal,
): Promise<AlmediaSyncResponse> {
  return requestJson(
    "/api/almedia/sync",
    almediaSyncResponseSchema,
    "Received an invalid Almedia sync response.",
    { method: "POST", signal },
  );
}
