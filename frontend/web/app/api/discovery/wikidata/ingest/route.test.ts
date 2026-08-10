import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ingestWikidataChannelsMock,
  requireIngestKeyMock,
  readJsonRequestBodyMock,
  toRouteErrorResponseMock,
} = vi.hoisted(() => ({
  ingestWikidataChannelsMock: vi.fn(),
  requireIngestKeyMock: vi.fn(),
  readJsonRequestBodyMock: vi.fn(),
  toRouteErrorResponseMock: vi.fn((error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 500 }),
  ),
}));

vi.mock("@scouting-platform/core", () => ({
  ingestWikidataChannels: ingestWikidataChannelsMock,
}));

vi.mock("../../../../../lib/api", () => ({
  requireIngestKey: requireIngestKeyMock,
  readJsonRequestBody: readJsonRequestBodyMock,
  toRouteErrorResponse: toRouteErrorResponseMock,
}));

import { POST } from "./route";

const VALID_CHANNEL = {
  youtubeChannelId: "UCabcdefghijklmnopqrstuv",
  label: "Example",
  countries: ["HR"],
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/discovery/wikidata/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-key" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireIngestKeyMock.mockReturnValue({ ok: true });
  readJsonRequestBodyMock.mockImplementation(async (request: Request) => ({
    ok: true,
    body: await request.json(),
  }));
  ingestWikidataChannelsMock.mockResolvedValue({
    received: 1,
    created: 1,
    updated: 0,
    skipped: 0,
  });
});

describe("POST /api/discovery/wikidata/ingest", () => {
  it("rejects requests with an invalid ingest key before reading the body", async () => {
    requireIngestKeyMock.mockReturnValue({
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(jsonRequest({ channels: [VALID_CHANNEL] }));

    expect(response.status).toBe(401);
    expect(readJsonRequestBodyMock).not.toHaveBeenCalled();
    expect(ingestWikidataChannelsMock).not.toHaveBeenCalled();
  });

  it("ingests a valid batch and returns the tallies", async () => {
    const response = await POST(jsonRequest({ channels: [VALID_CHANNEL] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      received: 1,
      created: 1,
      updated: 0,
      skipped: 0,
    });
    expect(ingestWikidataChannelsMock).toHaveBeenCalledWith({
      channels: [{ youtubeChannelId: VALID_CHANNEL.youtubeChannelId, label: "Example", countries: ["HR"] }],
    });
  });

  it("returns 400 for a malformed channel id without invoking the service", async () => {
    const response = await POST(jsonRequest({ channels: [{ ...VALID_CHANNEL, youtubeChannelId: "not-a-channel" }] }));

    expect(response.status).toBe(400);
    expect(ingestWikidataChannelsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the batch is empty", async () => {
    const response = await POST(jsonRequest({ channels: [] }));

    expect(response.status).toBe(400);
    expect(ingestWikidataChannelsMock).not.toHaveBeenCalled();
  });
});
