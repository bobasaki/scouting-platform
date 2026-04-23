import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteClientRequest,
  updateClientRequest,
} from "./clients-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("clients api helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates clients via PUT /api/clients/:id", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        id: clientId,
        name: "Local Client",
        domain: "local.example",
        countryRegion: "Croatia",
        city: "Zagreb",
        isActive: true,
        hubspotObjectId: null,
        hubspotObjectType: null,
        hubspotArchived: false,
        hubspotSyncedAt: null,
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    const response = await updateClientRequest(clientId, {
      name: "Local Client",
      domain: "local.example",
      countryRegion: "Croatia",
      city: "Zagreb",
      isActive: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Local Client",
        domain: "local.example",
        countryRegion: "Croatia",
        city: "Zagreb",
        isActive: true,
      }),
    });
    expect(response.name).toBe("Local Client");
  });

  it("deletes clients via DELETE /api/clients/:id", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await deleteClientRequest(clientId);

    expect(fetchSpy).toHaveBeenCalledWith(`/api/clients/${clientId}`, {
      method: "DELETE",
    });
  });
});
