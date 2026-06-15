import {
  createRunRequestSchema,
  createRunResponseSchema,
  listRunsQuerySchema,
  listRecentRunsResponseSchema,
  runStatusResponseSchema,
  updateRunResultRatingRequestSchema,
  updateRunResultRatingResponseSchema,
  type CreateRunRequest,
  type CreateRunResponse,
  type ListRecentRunsResponse,
  type ListRunsQuery,
  type RunStatusResponse,
  type UpdateRunResultRatingResponse,
} from "@scouting-platform/contracts";

const GENERIC_CREATE_RUN_REQUEST_ERROR_MESSAGE = "Unable to create run. Please try again.";
const GENERIC_RECENT_RUNS_REQUEST_ERROR_MESSAGE =
  "Unable to load recent runs. Please try again.";
const GENERIC_RUN_STATUS_REQUEST_ERROR_MESSAGE =
  "Unable to load run details. Please try again.";
const GENERIC_RUN_RESULT_RATING_REQUEST_ERROR_MESSAGE =
  "Unable to save the channel rating. Please try again.";
const INVALID_CREATE_RUN_RESPONSE_ERROR_MESSAGE =
  "Received an invalid run creation response from the server.";
const INVALID_RECENT_RUNS_RESPONSE_ERROR_MESSAGE =
  "Received an invalid recent runs response from the server.";
const INVALID_RUN_STATUS_RESPONSE_ERROR_MESSAGE =
  "Received an invalid run status response from the server.";

type ApiErrorBody = {
  error?: string;
};

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function normalizeErrorMessage(error: unknown, fallbackMessage: string): string {
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

function getApiErrorMessage(
  response: Response,
  payload: unknown,
  options?: {
    authorizationErrorMessage?: string;
    notFoundErrorMessage?: string;
    fallbackMessage?: string;
  },
): string {
  if (payload && typeof payload === "object") {
    const maybeErrorPayload = payload as ApiErrorBody;

    if (typeof maybeErrorPayload.error === "string" && maybeErrorPayload.error.trim().length > 0) {
      return maybeErrorPayload.error;
    }
  }

  if (response.status === 401 || response.status === 403) {
    return options?.authorizationErrorMessage ?? "You are not authorized to manage runs.";
  }

  if (response.status === 404 && options?.notFoundErrorMessage) {
    return options.notFoundErrorMessage;
  }

  return options?.fallbackMessage ?? GENERIC_CREATE_RUN_REQUEST_ERROR_MESSAGE;
}

function normalizeRequestError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return error;
  }

  return new Error(normalizeErrorMessage(error, fallbackMessage));
}

export async function createRun(input: CreateRunRequest): Promise<CreateRunResponse> {
  const requestPayload = createRunRequestSchema.parse(input);

  try {
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      throw new ApiRequestError(
        getApiErrorMessage(response, payload, {
          authorizationErrorMessage: "You are not authorized to create runs.",
          fallbackMessage: GENERIC_CREATE_RUN_REQUEST_ERROR_MESSAGE,
        }),
        response.status,
      );
    }

    const parsed = createRunResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(INVALID_CREATE_RUN_RESPONSE_ERROR_MESSAGE);
    }

    return parsed.data;
  } catch (error) {
    throw normalizeRequestError(error, GENERIC_CREATE_RUN_REQUEST_ERROR_MESSAGE);
  }
}

export async function fetchRecentRuns(
  input?: { signal?: AbortSignal; filters?: Partial<ListRunsQuery> },
): Promise<ListRecentRunsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (input?.filters) {
      const parsedFilters = listRunsQuerySchema.partial().parse(input.filters);

      if (parsedFilters.campaignManagerUserId) {
        searchParams.set("campaignManagerUserId", parsedFilters.campaignManagerUserId);
      }

      if (parsedFilters.client) {
        searchParams.set("client", parsedFilters.client);
      }

      if (parsedFilters.market) {
        searchParams.set("market", parsedFilters.market);
      }

      if (parsedFilters.limit) {
        searchParams.set("limit", String(parsedFilters.limit));
      }
    }

    const response = await fetch(`/api/runs${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`, {
      method: "GET",
      cache: "no-store",
      signal: input?.signal ?? null,
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      throw new ApiRequestError(
        getApiErrorMessage(response, payload, {
          authorizationErrorMessage: "You are not authorized to view recent runs.",
          fallbackMessage: GENERIC_RECENT_RUNS_REQUEST_ERROR_MESSAGE,
        }),
        response.status,
      );
    }

    const parsed = listRecentRunsResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(INVALID_RECENT_RUNS_RESPONSE_ERROR_MESSAGE);
    }

    return parsed.data;
  } catch (error) {
    throw normalizeRequestError(error, GENERIC_RECENT_RUNS_REQUEST_ERROR_MESSAGE);
  }
}

export async function fetchRunStatus(
  runId: string,
  signal?: AbortSignal,
): Promise<RunStatusResponse> {
  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      cache: "no-store",
      signal: signal ?? null,
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      throw new ApiRequestError(
        getApiErrorMessage(response, payload, {
          authorizationErrorMessage: "You are not authorized to view this run.",
          notFoundErrorMessage: "Run not found.",
          fallbackMessage: GENERIC_RUN_STATUS_REQUEST_ERROR_MESSAGE,
        }),
        response.status,
      );
    }

    const parsed = runStatusResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(INVALID_RUN_STATUS_RESPONSE_ERROR_MESSAGE);
    }

    return parsed.data;
  } catch (error) {
    throw normalizeRequestError(error, GENERIC_RUN_STATUS_REQUEST_ERROR_MESSAGE);
  }
}

export async function updateRunResultRating(
  runId: string,
  resultId: string,
  rating: number | null,
): Promise<UpdateRunResultRatingResponse> {
  const requestPayload = updateRunResultRatingRequestSchema.parse({ rating });

  try {
    const response = await fetch(
      `/api/runs/${encodeURIComponent(runId)}/results/${encodeURIComponent(resultId)}/rating`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      },
    );
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      throw new ApiRequestError(
        getApiErrorMessage(response, payload, {
          authorizationErrorMessage: "You are not authorized to rate this channel.",
          notFoundErrorMessage: "Run result not found.",
          fallbackMessage: GENERIC_RUN_RESULT_RATING_REQUEST_ERROR_MESSAGE,
        }),
        response.status,
      );
    }

    const parsed = updateRunResultRatingResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error("Received an invalid channel rating response from the server.");
    }

    return parsed.data;
  } catch (error) {
    throw normalizeRequestError(error, GENERIC_RUN_RESULT_RATING_REQUEST_ERROR_MESSAGE);
  }
}
