import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteCampaignMock,
  requireAuthenticatedSessionMock,
  toRouteErrorResponseMock,
  updateCampaignMock,
} = vi.hoisted(() => ({
  deleteCampaignMock: vi.fn(),
  requireAuthenticatedSessionMock: vi.fn(),
  toRouteErrorResponseMock: vi.fn((error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 500 }),
  ),
  updateCampaignMock: vi.fn(),
}));

vi.mock("@scouting-platform/core", () => ({
  deleteCampaign: deleteCampaignMock,
  updateCampaign: updateCampaignMock,
}));

vi.mock("../../../../lib/api", () => ({
  requireAuthenticatedSession: requireAuthenticatedSessionMock,
  toRouteErrorResponse: toRouteErrorResponseMock,
}));

import { DELETE, PUT } from "./route";

const campaignId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const payload = {
  name: "Local Campaign",
  clientId: "33333333-3333-4333-8333-333333333333",
  marketId: "44444444-4444-4444-8444-444444444444",
  month: "april",
  year: 2026,
  isActive: true,
};
const campaign = {
  id: campaignId,
  name: payload.name,
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
};

describe("campaign detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedSessionMock.mockResolvedValue({
      ok: true,
      userId,
      role: "admin",
    });
  });

  it("updates a campaign for authenticated users", async () => {
    updateCampaignMock.mockResolvedValue(campaign);

    const response = await PUT(
      new Request(`http://localhost/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      { params: Promise.resolve({ id: campaignId }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(campaign);
    expect(updateCampaignMock).toHaveBeenCalledWith({
      userId,
      campaignId,
      ...payload,
    });
  });

  it("deletes a campaign for authenticated users", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/campaigns/${campaignId}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: campaignId }) },
    );

    expect(response.status).toBe(204);
    expect(deleteCampaignMock).toHaveBeenCalledWith({
      userId,
      campaignId,
    });
  });

  it("rejects invalid ids and payloads", async () => {
    const invalidIdResponse = await DELETE(
      new Request("http://localhost/api/campaigns/not-a-uuid", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );
    expect(invalidIdResponse.status).toBe(400);

    const invalidPayloadResponse = await PUT(
      new Request(`http://localhost/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, name: "" }),
      }),
      { params: Promise.resolve({ id: campaignId }) },
    );
    expect(invalidPayloadResponse.status).toBe(400);
  });
});
