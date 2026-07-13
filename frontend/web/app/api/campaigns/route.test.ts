import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cachedJsonMock,
  createCampaignMock,
  listCampaignsMock,
  requireAuthenticatedSessionMock,
  toRouteErrorResponseMock,
} = vi.hoisted(() => ({
  cachedJsonMock: vi.fn((payload: unknown) => Response.json(payload)),
  createCampaignMock: vi.fn(),
  listCampaignsMock: vi.fn(),
  requireAuthenticatedSessionMock: vi.fn(),
  toRouteErrorResponseMock: vi.fn((error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 500 }),
  ),
}));

vi.mock("@scouting-platform/core", () => ({
  createCampaign: createCampaignMock,
  listCampaigns: listCampaignsMock,
}));

vi.mock("../../../lib/api", () => ({
  cachedJson: cachedJsonMock,
  requireAuthenticatedSession: requireAuthenticatedSessionMock,
  toRouteErrorResponse: toRouteErrorResponseMock,
}));

import { GET } from "./route";

const userId = "22222222-2222-4222-8222-222222222222";

describe("campaigns route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedSessionMock.mockResolvedValue({
      ok: true,
      userId,
      role: "admin",
    });
    listCampaignsMock.mockResolvedValue({
      items: [],
      filterOptions: {
        clients: [],
        markets: [],
        statuses: ["In progress", "Planned", "Finished", "Cancelled"],
      },
      permissions: {
        canCreate: true,
        role: "admin",
        userType: "admin",
      },
    });
  });

  it("passes repeated status filters to the campaign service", async () => {
    const response = await GET(
      new Request("http://localhost/api/campaigns?status=In%20progress&status=Planned"),
    );

    expect(response.status).toBe(200);
    expect(listCampaignsMock).toHaveBeenCalledWith({
      userId,
      query: {
        statuses: ["In progress", "Planned"],
      },
    });
  });
});
