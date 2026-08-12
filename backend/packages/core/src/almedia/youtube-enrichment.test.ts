import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchVideoChannelsMock,
  getYoutubeApiKeyMock,
  prismaMock,
  relinkMock,
  requestEnrichmentMock,
} = vi.hoisted(() => ({
  fetchVideoChannelsMock: vi.fn(),
  getYoutubeApiKeyMock: vi.fn(),
  prismaMock: {
    userProviderCredential: { findFirst: vi.fn() },
    almediaSyncRun: { findFirst: vi.fn() },
    almediaChannelEnrichment: { findMany: vi.fn() },
    almediaCatalogChannelLink: { findMany: vi.fn(), createMany: vi.fn() },
    channel: { findMany: vi.fn(), createMany: vi.fn() },
    auditEvent: { createMany: vi.fn() },
  },
  relinkMock: vi.fn(),
  requestEnrichmentMock: vi.fn(),
}));

vi.mock("@scouting-platform/db", () => ({ prisma: prismaMock }));
vi.mock("@scouting-platform/integrations", () => ({
  extractYoutubeVideoId: (value: string) => value.includes("abcdefghijk")
    ? "abcdefghijk"
    : value.includes("lmnopqrstuv")
      ? "lmnopqrstuv"
      : null,
  fetchYoutubeVideoChannels: fetchVideoChannelsMock,
  YoutubeVideoChannelProviderError: class YoutubeVideoChannelProviderError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("../auth", () => ({ getUserYoutubeApiKey: getYoutubeApiKeyMock }));
vi.mock("../enrichment", () => ({
  requestChannelLlmEnrichment: requestEnrichmentMock,
}));
vi.mock("./enrichments", () => ({
  relinkAlmediaEnrichmentCatalogChannels: relinkMock,
}));

import { YoutubeVideoChannelProviderError } from "@scouting-platform/integrations";

import { prepareAlmediaYoutubeEnrichments } from "./youtube-enrichment";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const CATALOG_CHANNEL_ID = "22222222-2222-4222-8222-222222222222";
const YOUTUBE_CHANNEL_ID = "UCaaaaaaaaaaaaaaaaaaaaaa";
const ENRICHMENT = {
  channel: {
    id: YOUTUBE_CHANNEL_ID,
    title: "YouTube Creator",
    description: "Gaming videos",
    country: "DE",
    topics: [],
    keywords: [],
  },
  metrics: {
    followers: 10_000,
    typicalViews: { median: 2_000 },
    typicalEngagementRatePct: 4,
    contentFormat: { dominant: "long_form" },
  },
  classification: {
    niche: "gaming",
    topics: [],
    audiencePositioning: "",
    brandFit: { suitability: "medium", categories: [] },
    brandSafety: { risk: "low" },
  },
  summary: "Gaming creator",
};

describe("Almedia automatic YouTube enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userProviderCredential.findFirst.mockResolvedValue({
      userId: ADMIN_ID,
    });
    prismaMock.almediaSyncRun.findFirst.mockResolvedValue(null);
    prismaMock.channel.createMany.mockResolvedValue({ count: 1 });
    prismaMock.auditEvent.createMany.mockResolvedValue({ count: 1 });
    prismaMock.almediaCatalogChannelLink.findMany.mockResolvedValue([]);
    prismaMock.almediaCatalogChannelLink.createMany.mockResolvedValue({ count: 1 });
    getYoutubeApiKeyMock.mockResolvedValue("youtube-key");
    relinkMock.mockResolvedValue(1);
    requestEnrichmentMock.mockResolvedValue({
      channelId: CATALOG_CHANNEL_ID,
      enrichment: { status: "queued" },
    });
  });

  it("ingests unlinked YouTube IDs, relinks them, and queues the standard job", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([
        {
          channelId: YOUTUBE_CHANNEL_ID,
          result: ENRICHMENT,
        },
      ])
      .mockResolvedValueOnce([
        {
          catalogChannelId: CATALOG_CHANNEL_ID,
          catalogChannel: {
            id: CATALOG_CHANNEL_ID,
            updatedAt: new Date("2026-08-11T00:00:00.000Z"),
            enrichment: null,
          },
        },
      ]);
    prismaMock.channel.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: CATALOG_CHANNEL_ID, youtubeChannelId: YOUTUBE_CHANNEL_ID },
      ]);

    const result = await prepareAlmediaYoutubeEnrichments({
      preferredRequesterUserId: ADMIN_ID,
    });

    expect(prismaMock.channel.createMany).toHaveBeenCalledWith({
      data: [{
        youtubeChannelId: YOUTUBE_CHANNEL_ID,
        title: "YouTube Creator",
        description: "Gaming videos",
        youtubeUrl: `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`,
      }],
      skipDuplicates: true,
    });
    expect(requestEnrichmentMock).toHaveBeenCalledWith({
      channelId: CATALOG_CHANNEL_ID,
      requestedByUserId: ADMIN_ID,
    });
    expect(result).toEqual({
      requesterUserId: ADMIN_ID,
      discoveryError: null,
      ingestedChannelCount: 1,
      discoveredChannelCount: 0,
      linkedEnrichmentCount: 1,
      queuedEnrichmentCount: 1,
      pendingEnrichmentCount: 0,
    });
  });

  it("keeps campaign refresh usable when provider discovery is paused", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.almediaCatalogChannelLink.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    fetchVideoChannelsMock.mockRejectedValue(new YoutubeVideoChannelProviderError(
      "YOUTUBE_QUOTA_EXCEEDED",
      429,
      "YouTube API quota exceeded",
    ));

    const result = await prepareAlmediaYoutubeEnrichments({
      preferredRequesterUserId: ADMIN_ID,
      campaigns: [{
        campaignName: "CAMPAIGNCREATOR_YT_R1",
        campaignSource: "agency",
        platform: "youtube",
        country: "US",
        publishedAt: null,
        cost: null,
        expectedCpm: null,
        viewCount: null,
        signupsPct: null,
        roasD7pD14: null,
        roasReturn: null,
        returnPct: null,
        appuD14: null,
        d7Purchases: null,
        channelName: "Campaign Creator",
        videoUrl: "https://youtu.be/abcdefghijk",
      }],
    });

    expect(result).toMatchObject({
      discoveredChannelCount: 0,
      discoveryError: "YouTube API quota exceeded",
    });
    expect(prismaMock.channel.createMany).not.toHaveBeenCalled();
  });

  it("discovers live campaign creators, stores catalog links, and queues them", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.channel.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: CATALOG_CHANNEL_ID,
        youtubeChannelId: YOUTUBE_CHANNEL_ID,
      }]);
    fetchVideoChannelsMock.mockResolvedValue(new Map([["abcdefghijk", {
      videoId: "abcdefghijk",
      channelId: YOUTUBE_CHANNEL_ID,
      channelTitle: "Campaign Creator",
    }]]));
    prismaMock.almediaCatalogChannelLink.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        catalogChannelId: CATALOG_CHANNEL_ID,
        catalogChannel: {
          id: CATALOG_CHANNEL_ID,
          updatedAt: new Date("2026-08-12T00:00:00.000Z"),
          enrichment: null,
        },
      }]);

    const result = await prepareAlmediaYoutubeEnrichments({
      preferredRequesterUserId: ADMIN_ID,
      campaigns: [{
        campaignName: "CAMPAIGNCREATOR_YT_R1",
        campaignSource: "agency",
        platform: "youtube",
        country: "US",
        publishedAt: new Date("2026-08-12T00:00:00.000Z"),
        cost: null,
        expectedCpm: null,
        viewCount: null,
        signupsPct: null,
        roasD7pD14: null,
        roasReturn: null,
        returnPct: null,
        appuD14: null,
        d7Purchases: null,
        channelName: "Campaign Creator",
        videoUrl: "https://youtu.be/abcdefghijk",
      }],
    });

    expect(prismaMock.almediaCatalogChannelLink.createMany).toHaveBeenCalledWith({
      data: [{
        channelKey: "CAMPAIGNCREATOR",
        catalogChannelId: CATALOG_CHANNEL_ID,
        sourceCampaignName: "CAMPAIGNCREATOR_YT_R1",
        sourceVideoUrl: "https://youtu.be/abcdefghijk",
      }],
      skipDuplicates: true,
    });
    expect(result.discoveredChannelCount).toBe(1);
    expect(requestEnrichmentMock).toHaveBeenCalledWith({
      channelId: CATALOG_CHANNEL_ID,
      requestedByUserId: ADMIN_ID,
    });
  });

  it("tries later campaign rounds when the first video no longer resolves", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.channel.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: CATALOG_CHANNEL_ID,
        youtubeChannelId: YOUTUBE_CHANNEL_ID,
      }]);
    fetchVideoChannelsMock.mockResolvedValue(new Map([["lmnopqrstuv", {
      videoId: "lmnopqrstuv",
      channelId: YOUTUBE_CHANNEL_ID,
      channelTitle: "Campaign Creator",
    }]]));
    prismaMock.almediaCatalogChannelLink.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const campaignBase = {
      campaignSource: "agency",
      platform: "youtube" as const,
      country: "US",
      publishedAt: new Date("2026-08-12T00:00:00.000Z"),
      cost: null,
      expectedCpm: null,
      viewCount: null,
      signupsPct: null,
      roasD7pD14: null,
      roasReturn: null,
      returnPct: null,
      appuD14: null,
      d7Purchases: null,
      channelName: "Campaign Creator",
    };

    const result = await prepareAlmediaYoutubeEnrichments({
      preferredRequesterUserId: ADMIN_ID,
      campaigns: [
        {
          ...campaignBase,
          campaignName: "CAMPAIGNCREATOR_YT_R1",
          videoUrl: "https://youtu.be/abcdefghijk",
        },
        {
          ...campaignBase,
          campaignName: "CAMPAIGNCREATOR_YT_R2",
          videoUrl: "https://youtu.be/lmnopqrstuv",
        },
      ],
    });

    expect(fetchVideoChannelsMock).toHaveBeenCalledWith({
      apiKey: "youtube-key",
      videoIds: ["abcdefghijk", "lmnopqrstuv"],
    });
    expect(prismaMock.almediaCatalogChannelLink.createMany).toHaveBeenCalledWith({
      data: [{
        channelKey: "CAMPAIGNCREATOR",
        catalogChannelId: CATALOG_CHANNEL_ID,
        sourceCampaignName: "CAMPAIGNCREATOR_YT_R2",
        sourceVideoUrl: "https://youtu.be/lmnopqrstuv",
      }],
      skipDuplicates: true,
    });
    expect(result.discoveredChannelCount).toBe(1);
  });

  it("defers ambiguous creator keys that resolve to different channels", async () => {
    const otherYoutubeChannelId = "UCbbbbbbbbbbbbbbbbbbbbbb";
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.almediaCatalogChannelLink.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    fetchVideoChannelsMock.mockResolvedValue(new Map([
      ["abcdefghijk", {
        videoId: "abcdefghijk",
        channelId: YOUTUBE_CHANNEL_ID,
        channelTitle: "First Creator",
      }],
      ["lmnopqrstuv", {
        videoId: "lmnopqrstuv",
        channelId: otherYoutubeChannelId,
        channelTitle: "Different Creator",
      }],
    ]));
    const campaignBase = {
      campaignSource: "agency",
      platform: "youtube" as const,
      country: "US",
      publishedAt: null,
      cost: null,
      expectedCpm: null,
      viewCount: null,
      signupsPct: null,
      roasD7pD14: null,
      roasReturn: null,
      returnPct: null,
      appuD14: null,
      d7Purchases: null,
      channelName: "Campaign Creator",
    };

    const result = await prepareAlmediaYoutubeEnrichments({
      preferredRequesterUserId: ADMIN_ID,
      campaigns: [
        {
          ...campaignBase,
          campaignName: "CAMPAIGNCREATOR_YT_R1",
          videoUrl: "https://youtu.be/abcdefghijk",
        },
        {
          ...campaignBase,
          campaignName: "CAMPAIGNCREATOR_YT_R2",
          videoUrl: "https://youtu.be/lmnopqrstuv",
        },
      ],
    });

    expect(result.discoveredChannelCount).toBe(0);
    expect(prismaMock.channel.createMany).not.toHaveBeenCalled();
    expect(prismaMock.almediaCatalogChannelLink.createMany).not.toHaveBeenCalled();
  });

  it("records system audit events when ingestion has no credentialed admin", async () => {
    prismaMock.userProviderCredential.findFirst.mockResolvedValue(null);
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([
        {
          channelId: YOUTUBE_CHANNEL_ID,
          result: ENRICHMENT,
        },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.channel.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: CATALOG_CHANNEL_ID, youtubeChannelId: YOUTUBE_CHANNEL_ID },
      ]);

    await prepareAlmediaYoutubeEnrichments();

    expect(prismaMock.auditEvent.createMany).toHaveBeenCalledWith({
      data: [{
        actorUserId: null,
        action: "almedia.channel.auto_ingested",
        entityType: "channel",
        entityId: CATALOG_CHANNEL_ID,
        metadata: { youtubeChannelId: YOUTUBE_CHANNEL_ID },
      }],
    });
  });

  it("propagates queue setup failures to the durable sync owner", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          catalogChannelId: CATALOG_CHANNEL_ID,
          catalogChannel: {
            id: CATALOG_CHANNEL_ID,
            updatedAt: new Date("2026-08-11T00:00:00.000Z"),
            enrichment: null,
          },
        },
      ]);
    requestEnrichmentMock.mockRejectedValueOnce(
      new Error("Assigned YouTube API key is required"),
    );

    await expect(prepareAlmediaYoutubeEnrichments()).rejects.toThrow(
      "Assigned YouTube API key is required",
    );
  });

  it("leaves cancelled enrichments for an explicit manual retry", async () => {
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          catalogChannelId: CATALOG_CHANNEL_ID,
          catalogChannel: {
            id: CATALOG_CHANNEL_ID,
            updatedAt: new Date("2026-08-11T00:00:00.000Z"),
            enrichment: {
              status: "CANCELLED",
              completedAt: null,
              lastEnrichedAt: null,
            },
          },
        },
      ]);

    const result = await prepareAlmediaYoutubeEnrichments();

    expect(requestEnrichmentMock).not.toHaveBeenCalled();
    expect(result.queuedEnrichmentCount).toBe(0);
    expect(result.pendingEnrichmentCount).toBe(0);
  });

  it("ingests safely but leaves work pending when no admin key exists", async () => {
    prismaMock.userProviderCredential.findFirst.mockResolvedValue(null);
    prismaMock.almediaChannelEnrichment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          catalogChannelId: CATALOG_CHANNEL_ID,
          catalogChannel: {
            id: CATALOG_CHANNEL_ID,
            updatedAt: new Date("2026-08-11T00:00:00.000Z"),
            enrichment: null,
          },
        },
      ]);
    relinkMock.mockResolvedValue(0);

    const result = await prepareAlmediaYoutubeEnrichments();

    expect(requestEnrichmentMock).not.toHaveBeenCalled();
    expect(result.requesterUserId).toBeNull();
    expect(result.pendingEnrichmentCount).toBe(1);
  });
});
