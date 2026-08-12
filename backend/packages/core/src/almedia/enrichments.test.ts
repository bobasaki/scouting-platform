import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  almediaChannelEnrichment: {
    findMany: vi.fn(),
  },
}));

vi.mock("@scouting-platform/db", () => ({ prisma: prismaMock }));

import {
  findCampaignEnrichment,
  findChannelEnrichment,
  loadAlmediaEnrichmentLookup,
  relinkAlmediaEnrichmentCatalogChannels,
} from "./enrichments";

const CATALOG_CHANNEL_ID = "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b";
const ENRICHMENT = {
  channel: {
    id: "UCasmrfixy",
    title: "ASMR Fixy",
    description: "Sleep and relaxation.",
    country: "PL",
    topics: [],
    keywords: [],
  },
  metrics: {
    followers: 236_000,
    typicalViews: { median: 30_542 },
    typicalEngagementRatePct: 3.97,
    contentFormat: { dominant: "long_form" },
  },
  classification: {
    niche: "asmr",
    topics: [],
    audiencePositioning: "",
    brandFit: { suitability: "medium", categories: [] },
    brandSafety: { risk: "low" },
  },
  summary: "",
};

describe("Almedia enrichment catalog links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the catalog id beside each parsed enrichment", async () => {
    prismaMock.almediaChannelEnrichment.findMany.mockResolvedValue([
      {
        channelId: "UCasmrfixy",
        catalogChannelId: CATALOG_CHANNEL_ID,
        catalogChannel: {
          updatedAt: new Date("2026-08-11T00:00:00.000Z"),
          influencerVertical: "ASMR",
          enrichment: null,
        },
        result: ENRICHMENT,
        links: [
          { sourceType: "campaign", sourceKey: "ASMRFIXY_YT_R1" },
          { sourceType: "channel_key", sourceKey: "ASMRFIXY" },
        ],
      },
    ]);

    const lookup = await loadAlmediaEnrichmentLookup();

    expect(findCampaignEnrichment(lookup, "ASMRFIXY_YT_R1")).toEqual({
      enrichment: ENRICHMENT,
      catalogChannelId: CATALOG_CHANNEL_ID,
      catalogEnrichmentStatus: "missing",
      catalogInfluencerVertical: "ASMR",
    });
    expect(findChannelEnrichment(lookup, "ASMRFIXY")).toEqual({
      enrichment: ENRICHMENT,
      catalogChannelId: CATALOG_CHANNEL_ID,
      catalogEnrichmentStatus: "missing",
      catalogInfluencerVertical: "ASMR",
    });
  });

  it("links every newly matched row with one set-based statement", async () => {
    prismaMock.$executeRaw.mockResolvedValue(2);

    await expect(relinkAlmediaEnrichmentCatalogChannels()).resolves.toBe(2);
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);

    const sql = (prismaMock.$executeRaw.mock.calls[0]?.[0] as TemplateStringsArray)
      .join(" ")
      .replace(/\s+/gu, " ");
    expect(sql).toContain("UPDATE almedia_channel_enrichments a");
    expect(sql).toContain("c.youtube_channel_id = a.channel_id");
    expect(sql).toContain("a.catalog_channel_id IS NULL");
  });
});
