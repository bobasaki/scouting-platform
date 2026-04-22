import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteClientMock,
  requireAuthenticatedSessionMock,
  toRouteErrorResponseMock,
  updateClientMock,
} = vi.hoisted(() => ({
  deleteClientMock: vi.fn(),
  requireAuthenticatedSessionMock: vi.fn(),
  toRouteErrorResponseMock: vi.fn((error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 500 }),
  ),
  updateClientMock: vi.fn(),
}));

vi.mock("@scouting-platform/core", () => ({
  deleteClient: deleteClientMock,
  updateClient: updateClientMock,
}));

vi.mock("../../../../lib/api", () => ({
  requireAuthenticatedSession: requireAuthenticatedSessionMock,
  toRouteErrorResponse: toRouteErrorResponseMock,
}));

import { DELETE, PUT } from "./route";

const clientId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const payload = {
  name: "Local Client",
  domain: "local.example",
  countryRegion: "Croatia",
  city: "Zagreb",
  isActive: true,
};
const client = {
  id: clientId,
  name: payload.name,
  domain: payload.domain,
  countryRegion: payload.countryRegion,
  city: payload.city,
  isActive: true,
  hubspotObjectId: null,
  hubspotObjectType: null,
  hubspotArchived: false,
  hubspotSyncedAt: null,
  createdAt: "2026-04-22T10:00:00.000Z",
  updatedAt: "2026-04-22T10:00:00.000Z",
};

describe("client detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedSessionMock.mockResolvedValue({
      ok: true,
      userId,
      role: "admin",
    });
  });

  it("updates a client for authenticated users", async () => {
    updateClientMock.mockResolvedValue(client);

    const response = await PUT(
      new Request(`http://localhost/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: clientId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(client);
    expect(updateClientMock).toHaveBeenCalledWith({
      userId,
      clientId,
      ...payload,
    });
  });

  it("deletes a client for authenticated users", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/clients/${clientId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: clientId }) },
    );

    expect(response.status).toBe(204);
    expect(deleteClientMock).toHaveBeenCalledWith({
      userId,
      clientId,
    });
  });

  it("rejects invalid ids and payloads", async () => {
    const invalidIdResponse = await DELETE(
      new Request("http://localhost/api/clients/not-a-uuid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(invalidIdResponse.status).toBe(400);

    const invalidPayloadResponse = await PUT(
      new Request(`http://localhost/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, name: "" }),
      }),
      { params: Promise.resolve({ id: clientId }) },
    );
    expect(invalidPayloadResponse.status).toBe(400);
  });
});
