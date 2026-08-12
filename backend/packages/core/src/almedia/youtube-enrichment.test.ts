import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, relinkMock, requestEnrichmentMock } = vi.hoisted(() => ({
  prismaMock: {
    userProviderCredential: { findFirst: vi.fn() },
    almediaSyncRun: { findFirst: vi.fn() },
    almediaChannelEnrichment: { findMany: vi.fn() },
    channel: { findMany: vi.fn(), createMany: vi.fn() },
    auditEvent: { createMany: vi.fn() },
  },
  relinkMock: vi.fn(),
  requestEnrichmentMock: vi.fn(),
}));

vi.mock("@scouting-platform/db", () => ({ prisma: prismaMock }));
vi.mock("../enrichment", () => ({
  requestChannelLlmEnrichment: requestEnrichmentMock,
}));
vi.mock("./enrichments", () => ({
  relinkAlmediaEnrichmentCatalogChannels: relinkMock,
}));

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
      ingestedChannelCount: 1,
      linkedEnrichmentCount: 1,
      queuedEnrichmentCount: 1,
      pendingEnrichmentCount: 0,
    });
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
