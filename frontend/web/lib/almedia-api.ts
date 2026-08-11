import {
  almediaAnalystStatusResponseSchema,
  almediaBookingResponseSchema,
  almediaBookingsResponseSchema,
  almediaCampaignsResponseSchema,
  almediaDealsResponseSchema,
  almediaInvoiceResponseSchema,
  almediaInvoicesResponseSchema,
  almediaScorecardResponseSchema,
  almediaSyncResponseSchema,
  type AlmediaAnalystMessage,
  type AlmediaAnalystStatusResponse,
  type AlmediaBookingResponse,
  type AlmediaBookingsResponse,
  type AlmediaCampaignsResponse,
  type AlmediaDealsResponse,
  type AlmediaInvoiceResponse,
  type AlmediaInvoicesResponse,
  type AlmediaScorecardResponse,
  type AlmediaSyncResponse,
  type BookingInput,
  type BookingInvoiceInput,
  type BookingUpdateInput,
} from "@scouting-platform/contracts";
import type { ZodType } from "zod";

import { parseAnalystFramePayload, parseAnalystSseChunk } from "./almedia/analyst-stream";

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

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestInitOptions = Readonly<{
  method?: RequestMethod;
  body?: unknown;
  signal?: AbortSignal | undefined;
}>;

function buildRequestInit(init: RequestInitOptions): RequestInit {
  return {
    method: init.method ?? "GET",
    cache: "no-store",
    signal: init.signal ?? null,
    ...(init.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(init.body),
        }),
  };
}

async function requestJson<T>(
  path: string,
  schema: ZodType<T>,
  invalidResponseMessage: string,
  init: RequestInitOptions = {},
): Promise<T> {
  try {
    const response = await fetch(path, buildRequestInit(init));
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

export async function fetchAlmediaBookings(
  signal?: AbortSignal,
): Promise<AlmediaBookingsResponse> {
  return requestJson(
    "/api/almedia/bookings",
    almediaBookingsResponseSchema,
    "Received an invalid Almedia bookings response.",
    { signal },
  );
}

export async function createAlmediaBooking(
  booking: BookingInput,
  signal?: AbortSignal,
): Promise<AlmediaBookingResponse> {
  return requestJson(
    "/api/almedia/bookings",
    almediaBookingResponseSchema,
    "Received an invalid Almedia booking response.",
    { method: "POST", body: booking, signal },
  );
}

export async function updateAlmediaBooking(
  bookingId: string,
  booking: BookingUpdateInput,
  signal?: AbortSignal,
): Promise<AlmediaBookingResponse> {
  return requestJson(
    `/api/almedia/bookings/${encodeURIComponent(bookingId)}`,
    almediaBookingResponseSchema,
    "Received an invalid Almedia booking response.",
    { method: "PATCH", body: booking, signal },
  );
}

/** Deletes return 204 with no body, so there is nothing to validate. */
async function requestDelete(path: string, signal?: AbortSignal): Promise<void> {
  try {
    const response = await fetch(path, buildRequestInit({ method: "DELETE", signal }));

    if (!response.ok) {
      throw new AlmediaApiRequestError(
        getApiErrorMessage(response, await readJsonPayload(response)),
        response.status,
      );
    }
  } catch (error) {
    throw normalizeRequestError(error);
  }
}

export async function deleteAlmediaBooking(
  bookingId: string,
  signal?: AbortSignal,
): Promise<void> {
  return requestDelete(
    `/api/almedia/bookings/${encodeURIComponent(bookingId)}`,
    signal,
  );
}

export async function fetchAlmediaInvoices(
  signal?: AbortSignal,
): Promise<AlmediaInvoicesResponse> {
  return requestJson(
    "/api/almedia/invoices",
    almediaInvoicesResponseSchema,
    "Received an invalid Almedia invoices response.",
    { signal },
  );
}

/** Upsert, keyed on the campaign name — re-invoicing replaces the snapshot. */
export async function recordAlmediaInvoice(
  invoice: BookingInvoiceInput,
  signal?: AbortSignal,
): Promise<AlmediaInvoiceResponse> {
  return requestJson(
    "/api/almedia/invoices",
    almediaInvoiceResponseSchema,
    "Received an invalid Almedia invoice response.",
    { method: "PUT", body: invoice, signal },
  );
}

export async function deleteAlmediaInvoice(
  invoiceId: string,
  signal?: AbortSignal,
): Promise<void> {
  return requestDelete(
    `/api/almedia/invoices/${encodeURIComponent(invoiceId)}`,
    signal,
  );
}

export async function fetchAlmediaAnalystStatus(
  signal?: AbortSignal,
): Promise<AlmediaAnalystStatusResponse> {
  return requestJson(
    "/api/almedia/analyst",
    almediaAnalystStatusResponseSchema,
    "Received an invalid Almedia analyst status response.",
    { signal },
  );
}

export interface AlmediaAnalystStreamHandlers {
  onDelta: (text: string) => void;
  onError: (message: string) => void;
}

/**
 * Stream one analyst answer, invoking `onDelta` as text arrives.
 *
 * Failures split two ways on purpose. Anything that happens before the response
 * is committed — auth, validation, no key configured — comes back as a normal
 * JSON error and is thrown, so the caller sees the real status message. Once the
 * stream is open the server can only report through an `error` frame, which is
 * handed to `onError` while whatever text already arrived stays on screen.
 */
export async function streamAlmediaAnalystAnswer(
  request: Readonly<{ messages: readonly AlmediaAnalystMessage[]; context: string }>,
  handlers: AlmediaAnalystStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;

  try {
    response = await fetch(
      "/api/almedia/analyst",
      buildRequestInit({ method: "POST", body: request, signal }),
    );
  } catch (error) {
    throw normalizeRequestError(error);
  }

  if (!response.ok || !response.body) {
    throw new AlmediaApiRequestError(
      getApiErrorMessage(response, await readJsonPayload(response)),
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const { frames, rest } = parseAnalystSseChunk(buffer);
      buffer = rest;

      for (const frame of frames) {
        const payload = parseAnalystFramePayload(frame);

        if (!payload) {
          continue;
        }

        if (frame.event === "delta" && payload.text) {
          handlers.onDelta(payload.text);
        } else if (frame.event === "error" && payload.error) {
          handlers.onError(payload.error);
        }
      }
    }
  } finally {
    // Releasing the lock lets an aborted fetch tear the body down promptly
    // instead of holding the connection until GC.
    reader.releaseLock();
  }
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
