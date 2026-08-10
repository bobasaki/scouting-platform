import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlmediaApiRequestError,
  fetchAlmediaCampaigns,
  fetchAlmediaDeals,
  fetchAlmediaScorecard,
  requestAlmediaSync,
} from "./almedia-api";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const sync = {
  status: "completed",
  agency: "ARCH.",
  campaignCount: 1,
  syncedAt: "2026-08-10T09:00:00.000Z",
  startedAt: "2026-08-10T08:59:00.000Z",
  completedAt: "2026-08-10T09:00:00.000Z",
  lastError: null,
};

const options = {
  cm: ["Lucija P"],
  country: ["PL"],
  vertical: ["Gaming"],
  category: ["integration"],
  platform: ["youtube"],
  sizeTier: ["10-20k"],
  status: ["published"],
  month: ["2026-07"],
};

const deal = {
  channelKey: "ASMRFIXY",
  channelName: "ASMR Fixy",
  campaignName: "ASMRFIXY_YT_R1",
  videoUrl: null,
  platform: "youtube",
  publishedAt: "2026-07-13",
  cost: 1000,
  expectedCpm: 20,
  viewCount: 40_000,
  returnPct: 90,
  signupsPct: null,
  d7Purchases: null,
  roasReturn: null,
  appuD14: null,
  expectedViews: 50_000,
  deliveryPct: 80,
  cm: "Lucija P",
  country: "PL",
  vertical: "Gaming",
  verticals: ["Gaming"],
  category: "integration",
  hasEnrichment: false,
  creatorFollowers: null,
  creatorTypicalViews: null,
  creatorEngagementRatePct: null,
  creatorContentFormat: null,
  creatorBrandFit: null,
  creatorSafetyRisk: null,
  status: "published",
  intBudget: 12_000,
  extBudget: 15_000,
  month: "2026-07",
  sizeTier: "10-20k",
  hasCampaign: true,
  hasBooking: true,
  returnTier: "rebooking",
  maturity: { status: "matured", daysRemaining: 0 },
};

describe("almedia api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches deals without caching the response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ deals: [deal], options, sync }));

    const result = await fetchAlmediaDeals();

    expect(result.deals).toHaveLength(1);
    expect(result.sync.agency).toBe("ARCH.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/almedia/deals",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("fetches campaigns", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        campaigns: [
          {
            campaignName: "ASMRFIXY_YT_R1",
            campaignSource: "ARCH.",
            platform: "youtube",
            country: "PL",
            publishedAt: "2026-07-13T18:00:20.000Z",
            cost: 1000,
            expectedCpm: 20,
            viewCount: 40_000,
            signupsPct: null,
            roasD7pD14: null,
            roasReturn: null,
            returnPct: 90,
            appuD14: null,
            d7Purchases: null,
            channelName: "ASMR Fixy",
            videoUrl: null,
          },
        ],
        sync,
      }),
    );

    expect((await fetchAlmediaCampaigns()).campaigns).toHaveLength(1);
  });

  it("fetches the scorecard", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ months: [], rows: [], unscheduledCount: 0 }),
    );

    expect(await fetchAlmediaScorecard()).toEqual({
      months: [],
      rows: [],
      unscheduledCount: 0,
    });
  });

  it("posts a sync request and returns the run id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ runId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b" }, 202),
    );

    expect(await requestAlmediaSync()).toEqual({
      runId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/almedia/sync",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the server error message and status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "Forbidden" }, 403),
    );

    await expect(fetchAlmediaDeals()).rejects.toMatchObject({
      name: "AlmediaApiRequestError",
      message: "Forbidden",
      status: 403,
    });
  });

  it("falls back to an authorization message when the body has none", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 401 }));

    await expect(fetchAlmediaDeals()).rejects.toBeInstanceOf(AlmediaApiRequestError);
    await expect(fetchAlmediaDeals()).rejects.toThrow(
      "You are not authorized to view Almedia tracking.",
    );
  });

  it("rejects a response that does not match the contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ deals: [{ channelKey: "ASMRFIXY" }], options, sync }),
    );

    await expect(fetchAlmediaDeals()).rejects.toThrow(
      "Received an invalid Almedia deals response.",
    );
  });

  it("passes an abort signal through and preserves AbortError", async () => {
    const controller = new AbortController();

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      throw abortError;
    });

    await expect(fetchAlmediaDeals(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
