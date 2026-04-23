import { z } from "zod";

import { HubspotError } from "./contacts";

type FetchLike = typeof fetch;

const hubspotObjectSchema = z.object({
  objectTypeId: z.string().trim().min(1),
  fullyQualifiedName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  labels: z
    .object({
      singular: z.string().optional(),
      plural: z.string().optional(),
    })
    .optional(),
});

const hubspotObjectSchemasResponseSchema = z.object({
  results: z.array(hubspotObjectSchema).default([]),
});

const hubspotCustomObjectRecordSchema = z.object({
  id: z.string().trim().min(1),
  properties: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean().default(false),
  archivedAt: z.string().nullable().optional(),
});

const hubspotCustomObjectsResponseSchema = z.object({
  results: z.array(hubspotCustomObjectRecordSchema).default([]),
  paging: z
    .object({
      next: z
        .object({
          after: z.string().trim().min(1).optional(),
        })
        .optional(),
    })
    .optional(),
});

const hubspotAssociationsResponseSchema = z.object({
  results: z
    .array(
      z.object({
        from: z.object({
          id: z.union([z.string(), z.number()]).transform((value) => String(value)),
        }),
        to: z
          .array(
            z.object({
              toObjectId: z.union([z.string(), z.number()]).transform((value) => String(value)),
              associationTypes: z
                .array(
                  z.object({
                    typeId: z.number().int().optional(),
                  }),
                )
                .default([]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

const baseInputSchema = z.object({
  apiKey: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().url().default("https://api.hubapi.com"),
  fetchFn: z.custom<FetchLike>().optional(),
});

const fetchSchemasInputSchema = baseInputSchema;

const fetchCustomObjectsInputSchema = baseInputSchema.extend({
  objectType: z.string().trim().min(1),
  properties: z.array(z.string().trim().min(1)).default([]),
  archived: z.boolean().default(false),
  after: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(100),
});

const fetchAssociationsInputSchema = baseInputSchema.extend({
  fromObjectType: z.string().trim().min(1),
  toObjectType: z.string().trim().min(1),
  objectIds: z.array(z.string().trim().min(1)).min(1).max(1000),
  associationTypeId: z.number().int().positive().optional(),
});

export type HubspotObjectSchema = z.infer<typeof hubspotObjectSchema>;
export type HubspotCustomObjectRecord = z.infer<typeof hubspotCustomObjectRecordSchema>;
export type HubspotCustomObject = HubspotCustomObjectRecord;
export type FetchHubspotObjectSchemasInput = z.input<typeof fetchSchemasInputSchema>;
export type FetchHubspotCustomObjectsInput = z.input<typeof fetchCustomObjectsInputSchema>;
export type FetchHubspotAssociationsInput = z.input<typeof fetchAssociationsInputSchema>;

export type FetchHubspotCustomObjectsResult = Readonly<{
  results: HubspotCustomObjectRecord[];
  nextAfter: string | null;
}>;

export type HubspotAssociationMap = Map<string, string[]>;

function getApiKey(override?: string): string {
  const apiKey = override?.trim() || process.env.HUBSPOT_API_KEY?.trim();

  if (!apiKey) {
    throw new HubspotError(
      "HUBSPOT_API_KEY_MISSING",
      500,
      "HUBSPOT_API_KEY is required for HubSpot custom object sync",
    );
  }

  return apiKey;
}

function getFetch(fetchFn?: FetchLike): FetchLike {
  return fetchFn ?? fetch;
}

function toProviderError(response: Response): HubspotError {
  if (response.status === 401 || response.status === 403) {
    return new HubspotError(
      "HUBSPOT_AUTH_FAILED",
      401,
      "HubSpot credentials are invalid or unauthorized",
    );
  }

  if (response.status === 429) {
    return new HubspotError(
      "HUBSPOT_RATE_LIMITED",
      429,
      "HubSpot rate limit exceeded",
    );
  }

  return new HubspotError(
    "HUBSPOT_REQUEST_FAILED",
    502,
    "HubSpot custom object sync failed",
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    authorization: `Bearer ${apiKey}`,
    accept: "application/json",
  };
}

export async function fetchHubspotObjectSchemas(
  rawInput: FetchHubspotObjectSchemasInput = {},
): Promise<HubspotObjectSchema[]> {
  const input = fetchSchemasInputSchema.parse(rawInput);
  const apiKey = getApiKey(input.apiKey);
  const fetchFn = getFetch(input.fetchFn);
  const url = new URL("/crm/v3/schemas", input.baseUrl);

  const response = await fetchFn(url, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw toProviderError(response);
  }

  const payload = await parseJsonResponse(response);
  const parsed = hubspotObjectSchemasResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new HubspotError(
      "HUBSPOT_INVALID_RESPONSE",
      502,
      "HubSpot returned an invalid custom object schema response",
    );
  }

  return parsed.data.results;
}

export async function fetchHubspotCustomObjects(
  rawInput: FetchHubspotCustomObjectsInput,
): Promise<FetchHubspotCustomObjectsResult> {
  const input = fetchCustomObjectsInputSchema.parse(rawInput);
  const apiKey = getApiKey(input.apiKey);
  const fetchFn = getFetch(input.fetchFn);
  const url = new URL(`/crm/v3/objects/${encodeURIComponent(input.objectType)}`, input.baseUrl);
  url.searchParams.set("limit", String(input.limit));
  url.searchParams.set("archived", input.archived ? "true" : "false");

  if (input.after) {
    url.searchParams.set("after", input.after);
  }

  if (input.properties.length > 0) {
    url.searchParams.set("properties", input.properties.join(","));
  }

  const response = await fetchFn(url, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw toProviderError(response);
  }

  const payload = await parseJsonResponse(response);
  const parsed = hubspotCustomObjectsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new HubspotError(
      "HUBSPOT_INVALID_RESPONSE",
      502,
      "HubSpot returned an invalid custom object response",
    );
  }

  return {
    results: parsed.data.results,
    nextAfter: parsed.data.paging?.next?.after ?? null,
  };
}

export async function fetchHubspotAssociations(
  rawInput: FetchHubspotAssociationsInput,
): Promise<HubspotAssociationMap> {
  const input = fetchAssociationsInputSchema.parse(rawInput);
  const apiKey = getApiKey(input.apiKey);
  const fetchFn = getFetch(input.fetchFn);
  const url = new URL(
    `/crm/v4/associations/${encodeURIComponent(input.fromObjectType)}/${encodeURIComponent(input.toObjectType)}/batch/read`,
    input.baseUrl,
  );

  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      ...buildHeaders(apiKey),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      inputs: input.objectIds.map((id) => ({ id })),
    }),
  });

  if (!response.ok) {
    throw toProviderError(response);
  }

  const payload = await parseJsonResponse(response);
  const parsed = hubspotAssociationsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new HubspotError(
      "HUBSPOT_INVALID_RESPONSE",
      502,
      "HubSpot returned an invalid association response",
    );
  }

  return new Map(
    parsed.data.results.map((result) => [
      result.from.id,
      result.to
        .filter((association) =>
          typeof input.associationTypeId === "number"
            ? association.associationTypes.some((type) => type.typeId === input.associationTypeId)
            : true,
        )
        .map((association) => association.toObjectId),
    ]),
  );
}
