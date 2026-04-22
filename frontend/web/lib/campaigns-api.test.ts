import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteCampaignRequest,
  updateCampaignRequest,
} from "./campaigns-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("campaigns api helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates campaigns via PUT /api/campaigns/:id", async () => {
    const campaignId = "11111111-1111-4111-8111-111111111111";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        id: campaignId,
        name: "Local Campaign",
        client: null,
        market: null,
        briefLink: null,
        month: "april",
        year: 2026,
        isActive: true,
        hubspotObjectId: null,
        hubspotObjectType: null,
        hubspotArchived: false,
        hubspotSyncedAt: null,
        createdAt: "2026-04-22T10:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z",
      }),
    );

    const response = await updateCampaignRequest(campaignId, {
      name: "Local Campaign",
      clientId: "22222222-2222-4222-8222-222222222222",
      month: "april",
      year: 2026,
      isActive: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(`/api/campaigns/${campaignId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Local Campaign",
        clientId: "22222222-2222-4222-8222-222222222222",
        month: "april",
        year: 2026,
        isActive: true,
      }),
    });
    expect(response.name).toBe("Local Campaign");
  });

  it("deletes campaigns via DELETE /api/campaigns/:id", async () => {
    const campaignId = "11111111-1111-4111-8111-111111111111";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await deleteCampaignRequest(campaignId);

    expect(fetchSpy).toHaveBeenCalledWith(`/api/campaigns/${campaignId}`, {
      method: "DELETE",
    });
  });
});
