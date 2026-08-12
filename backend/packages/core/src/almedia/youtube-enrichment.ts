import {
  ChannelEnrichmentStatus as PrismaChannelEnrichmentStatus,
  CredentialProvider,
  type Prisma,
  Role,
} from "@prisma/client";
import { almediaChannelEnrichmentSchema } from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";
import {
  extractYoutubeVideoId,
  fetchYoutubeVideoChannels,
  type AlmediaCampaign,
  YoutubeVideoChannelProviderError,
} from "@scouting-platform/integrations";

import { getUserYoutubeApiKey } from "../auth";
import { requestChannelLlmEnrichment } from "../enrichment";
import { resolveChannelEnrichmentStatus } from "../enrichment/status";
import { campaignBaseKey } from "./channel-key";
import { relinkAlmediaEnrichmentCatalogChannels } from "./enrichments";

const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/u;

export const ALMEDIA_AUTO_ENRICHMENT_BATCH_SIZE = 5;
export const ALMEDIA_AUTO_ENRICHMENT_MAX_BATCH_SIZE = 25;

export type PrepareAlmediaYoutubeEnrichmentsResult = Readonly<{
  requesterUserId: string | null;
  discoveryError: string | null;
  ingestedChannelCount: number;
  discoveredChannelCount: number;
  linkedEnrichmentCount: number;
  queuedEnrichmentCount: number;
  pendingEnrichmentCount: number;
}>;

type UserIdRow = Readonly<{ userId: string }>;
type RecentRunRow = Readonly<{ requestedByUserId: string | null }>;
type UnlinkedAlmediaEnrichmentRow = Readonly<{
  channelId: string;
  result: Prisma.JsonValue;
}>;
type YoutubeChannelIdRow = Readonly<{ youtubeChannelId: string }>;
type CreatedChannelRow = Readonly<{
  id: string;
  youtubeChannelId: string;
}>;
type ExistingCatalogLinkRow = Readonly<{ channelKey: string }>;
type CatalogAlmediaEnrichmentRow = Readonly<{
  catalogChannelId: string | null;
  catalogChannel: {
    id: string;
    updatedAt: Date;
    enrichment: {
      status: PrismaChannelEnrichmentStatus;
      completedAt: Date | null;
      lastEnrichedAt: Date | null;
    } | null;
  } | null;
}>;

/*
 * Prisma's recursive relation inference becomes disproportionately expensive for
 * this orchestration module. These narrow wrappers preserve checked query args
 * while fixing each result shape at the select boundary.
 */
const delegates = {
  get credentials() {
    return prisma.userProviderCredential as unknown as {
      findFirst(args: Prisma.UserProviderCredentialFindFirstArgs): Promise<UserIdRow | null>;
    };
  },
  get syncRuns() {
    return prisma.almediaSyncRun as unknown as {
      findFirst(args: Prisma.AlmediaSyncRunFindFirstArgs): Promise<RecentRunRow | null>;
    };
  },
  get unlinkedAlmediaEnrichments() {
    return prisma.almediaChannelEnrichment as unknown as {
      findMany(args: Prisma.AlmediaChannelEnrichmentFindManyArgs): Promise<UnlinkedAlmediaEnrichmentRow[]>;
    };
  },
  get catalogAlmediaEnrichments() {
    return prisma.almediaChannelEnrichment as unknown as {
      findMany(args: Prisma.AlmediaChannelEnrichmentFindManyArgs): Promise<CatalogAlmediaEnrichmentRow[]>;
    };
  },
  get channelIds() {
    return prisma.channel as unknown as {
      findMany(args: Prisma.ChannelFindManyArgs): Promise<YoutubeChannelIdRow[]>;
    };
  },
  get createdChannels() {
    return prisma.channel as unknown as {
      findMany(args: Prisma.ChannelFindManyArgs): Promise<CreatedChannelRow[]>;
    };
  },
  get catalogLinks() {
    return prisma.almediaCatalogChannelLink as unknown as {
      findMany(args: Prisma.AlmediaCatalogChannelLinkFindManyArgs): Promise<
        Array<ExistingCatalogLinkRow | CatalogAlmediaEnrichmentRow>
      >;
      createMany(args: Prisma.AlmediaCatalogChannelLinkCreateManyArgs): Promise<{ count: number }>;
    };
  },
  get channels() {
    return prisma.channel as unknown as {
      createMany(args: Prisma.ChannelCreateManyArgs): Promise<unknown>;
    };
  },
  get audits() {
    return prisma.auditEvent as unknown as {
      createMany(args: Prisma.AuditEventCreateManyArgs): Promise<unknown>;
    };
  },
};

function normalizeBatchSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return ALMEDIA_AUTO_ENRICHMENT_BATCH_SIZE;
  }

  return Math.min(
    Math.max(1, Math.trunc(value)),
    ALMEDIA_AUTO_ENRICHMENT_MAX_BATCH_SIZE,
  );
}

async function credentialedAdmin(userId: string): Promise<string | null> {
  const credential = await delegates.credentials.findFirst({
    where: {
      userId,
      provider: CredentialProvider.YOUTUBE_DATA_API,
      user: { isActive: true, role: Role.ADMIN },
    },
    select: { userId: true },
  });

  return credential?.userId ?? null;
}

/**
 * Scheduled runs reuse the most recently participating credentialed admin.
 * The final fallback makes the very first scheduled run useful after setup,
 * while still restricting automatic provider spend to an active admin key.
 */
export async function resolveAlmediaEnrichmentRequester(
  preferredUserId?: string | null,
): Promise<string | null> {
  if (preferredUserId) {
    const preferred = await credentialedAdmin(preferredUserId);

    if (preferred) {
      return preferred;
    }
  }

  const recentRun = await delegates.syncRuns.findFirst({
    where: {
      requestedByUserId: { not: null },
      requestedByUser: {
        isActive: true,
        role: Role.ADMIN,
        credentials: {
          some: { provider: CredentialProvider.YOUTUBE_DATA_API },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { requestedByUserId: true },
  });

  if (recentRun?.requestedByUserId) {
    return recentRun.requestedByUserId;
  }

  const fallback = await delegates.credentials.findFirst({
    where: {
      provider: CredentialProvider.YOUTUBE_DATA_API,
      user: { isActive: true, role: Role.ADMIN },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  return fallback?.userId ?? null;
}

/** Ingest the YouTube IDs already present in the imported Almedia documents. */
async function ingestMissingAlmediaChannels(
  actorUserId: string | null,
): Promise<number> {
  const unlinked = await delegates.unlinkedAlmediaEnrichments.findMany({
    where: { catalogChannelId: null },
    select: { channelId: true, result: true },
  });
  const candidates = unlinked.flatMap((row) => {
    const parsed = almediaChannelEnrichmentSchema.safeParse(row.result);

    if (!parsed.success || !YOUTUBE_CHANNEL_ID_PATTERN.test(row.channelId)) {
      return [];
    }

    return [{
      youtubeChannelId: row.channelId,
      title: parsed.data.channel.title.trim() || row.channelId,
      description: parsed.data.channel.description.trim() || null,
      youtubeUrl: `https://www.youtube.com/channel/${row.channelId}`,
    }];
  });

  if (candidates.length === 0) {
    return 0;
  }

  const existing = await delegates.channelIds.findMany({
    where: {
      youtubeChannelId: { in: candidates.map((candidate) => candidate.youtubeChannelId) },
    },
    select: { youtubeChannelId: true },
  });
  const existingIds = new Set(existing.map((channel) => channel.youtubeChannelId));
  const missing = candidates.filter(
    (candidate) => !existingIds.has(candidate.youtubeChannelId),
  );

  if (missing.length === 0) {
    return 0;
  }

  await delegates.channels.createMany({ data: missing, skipDuplicates: true });

  const created = await delegates.createdChannels.findMany({
    where: {
      youtubeChannelId: { in: missing.map((candidate) => candidate.youtubeChannelId) },
    },
    select: { id: true, youtubeChannelId: true },
  });

  if (created.length > 0) {
    await delegates.audits.createMany({
      data: created.map((channel) => ({
        actorUserId,
        action: "almedia.channel.auto_ingested",
        entityType: "channel",
        entityId: channel.id,
        metadata: { youtubeChannelId: channel.youtubeChannelId },
      })),
    });
  }

  return missing.length;
}

function isYoutubeCampaign(campaign: AlmediaCampaign): boolean {
  const platform = campaign.platform.trim().toLowerCase();
  return platform === "yt" || platform.includes("youtube");
}

/**
 * Resolve live campaign video URLs to catalog channels. The creator-key link
 * is stored separately from tracker enrichment documents so current feed rows
 * can use the platform enrichment pipeline immediately.
 */
async function discoverCampaignCatalogChannels(
  campaigns: readonly AlmediaCampaign[],
  requesterUserId: string | null,
): Promise<number> {
  if (!requesterUserId) {
    return 0;
  }

  type CampaignVideoCandidate = {
    campaign: AlmediaCampaign;
    videoId: string;
  };
  const byChannelKey = new Map<string, CampaignVideoCandidate[]>();

  for (const campaign of campaigns) {
    const videoId = campaign.videoUrl
      ? extractYoutubeVideoId(campaign.videoUrl)
      : null;
    const channelKey = campaignBaseKey(campaign.campaignName);

    if (
      isYoutubeCampaign(campaign)
      && videoId
      && channelKey
    ) {
      const candidates = byChannelKey.get(channelKey) ?? [];

      if (!candidates.some((candidate) => candidate.videoId === videoId)) {
        candidates.push({ campaign, videoId });
        byChannelKey.set(channelKey, candidates);
      }
    }
  }

  if (byChannelKey.size === 0) {
    return 0;
  }

  const existingLinks = await delegates.catalogLinks.findMany({
    where: { channelKey: { in: [...byChannelKey.keys()] } },
    select: { channelKey: true },
  }) as ExistingCatalogLinkRow[];

  for (const link of existingLinks) {
    byChannelKey.delete(link.channelKey);
  }

  if (byChannelKey.size === 0) {
    return 0;
  }

  const apiKey = await getUserYoutubeApiKey(requesterUserId);

  if (!apiKey) {
    return 0;
  }

  const resolvedByVideoId = await fetchYoutubeVideoChannels({
    apiKey,
    videoIds: [...byChannelKey.values()].flatMap((candidates) =>
      candidates.map((candidate) => candidate.videoId)),
  });
  const resolutionByChannelKey = new Map<string, {
    candidate: CampaignVideoCandidate;
    channelId: string;
    channelTitle: string;
  }>();

  for (const [channelKey, candidates] of byChannelKey) {
    const resolvedCandidates = candidates.flatMap((candidate) => {
      const resolved = resolvedByVideoId.get(candidate.videoId);
      return resolved ? [{ candidate, resolved }] : [];
    });
    const channelIds = new Set(
      resolvedCandidates.map(({ resolved }) => resolved.channelId),
    );

    // A normalized creator key must never be permanently linked by feed order
    // when campaign rounds point at different YouTube channels.
    if (channelIds.size !== 1) {
      continue;
    }

    const resolvedCandidate = resolvedCandidates[0];

    if (resolvedCandidate) {
      resolutionByChannelKey.set(channelKey, {
        candidate: resolvedCandidate.candidate,
        channelId: resolvedCandidate.resolved.channelId,
        channelTitle: resolvedCandidate.resolved.channelTitle,
      });
    }
  }

  const resolvedChannels = new Map<string, {
    title: string;
    youtubeChannelId: string;
  }>();

  for (const resolution of resolutionByChannelKey.values()) {
    resolvedChannels.set(resolution.channelId, {
      title: resolution.channelTitle,
      youtubeChannelId: resolution.channelId,
    });
  }

  if (resolvedChannels.size === 0) {
    return 0;
  }

  const existingChannels = await delegates.createdChannels.findMany({
    where: { youtubeChannelId: { in: [...resolvedChannels.keys()] } },
    select: { id: true, youtubeChannelId: true },
  });
  const existingChannelIds = new Set(
    existingChannels.map((channel) => channel.youtubeChannelId),
  );
  const missingChannels = [...resolvedChannels.values()].filter(
    (channel) => !existingChannelIds.has(channel.youtubeChannelId),
  );

  if (missingChannels.length > 0) {
    await delegates.channels.createMany({
      data: missingChannels.map((channel) => ({
        youtubeChannelId: channel.youtubeChannelId,
        title: channel.title,
        youtubeUrl: `https://www.youtube.com/channel/${channel.youtubeChannelId}`,
      })),
      skipDuplicates: true,
    });
  }

  const catalogChannels = await delegates.createdChannels.findMany({
    where: { youtubeChannelId: { in: [...resolvedChannels.keys()] } },
    select: { id: true, youtubeChannelId: true },
  });
  const catalogIdByYoutubeId = new Map(
    catalogChannels.map((channel) => [channel.youtubeChannelId, channel.id]),
  );
  const links = [...resolutionByChannelKey.entries()].flatMap(
    ([channelKey, resolution]) => {
      const catalogChannelId = catalogIdByYoutubeId.get(resolution.channelId);

      return catalogChannelId ? [{
        channelKey,
        catalogChannelId,
        sourceCampaignName: resolution.candidate.campaign.campaignName,
        sourceVideoUrl: resolution.candidate.campaign.videoUrl,
      }] : [];
    },
  );

  if (links.length === 0) {
    return 0;
  }

  const createdLinks = await delegates.catalogLinks.createMany({
    data: links,
    skipDuplicates: true,
  });
  const newlyCreatedChannels = catalogChannels.filter(
    (channel) => !existingChannelIds.has(channel.youtubeChannelId),
  );

  if (newlyCreatedChannels.length > 0) {
    await delegates.audits.createMany({
      data: newlyCreatedChannels.map((channel) => ({
        actorUserId: requesterUserId,
        action: "almedia.channel.campaign_discovered",
        entityType: "channel",
        entityId: channel.id,
        metadata: { youtubeChannelId: channel.youtubeChannelId },
      })),
    });
  }

  return createdLinks.count;
}

type CatalogEnrichmentCandidate = Readonly<{
  channelId: string;
  updatedAt: Date;
  enrichment: {
    status: PrismaChannelEnrichmentStatus;
    completedAt: Date | null;
    lastEnrichedAt: Date | null;
  } | null;
}>;

async function listEnrichmentCandidates(): Promise<CatalogEnrichmentCandidate[]> {
  const catalogSelect = {
    catalogChannelId: true,
    catalogChannel: {
      select: {
        id: true,
        updatedAt: true,
        enrichment: {
          select: {
            status: true,
            completedAt: true,
            lastEnrichedAt: true,
          },
        },
      },
    },
  } as const;
  const [legacyRows, campaignRows] = await Promise.all([
    delegates.catalogAlmediaEnrichments.findMany({
      where: { catalogChannelId: { not: null } },
      select: catalogSelect,
    }),
    delegates.catalogLinks.findMany({ select: catalogSelect }) as Promise<CatalogAlmediaEnrichmentRow[]>,
  ]);
  const rows = [...legacyRows, ...campaignRows];
  const byChannelId = new Map<string, CatalogEnrichmentCandidate>();

  for (const row of rows) {
    if (!row.catalogChannelId || !row.catalogChannel) {
      continue;
    }

    byChannelId.set(row.catalogChannelId, {
      channelId: row.catalogChannel.id,
      updatedAt: row.catalogChannel.updatedAt,
      enrichment: row.catalogChannel.enrichment,
    });
  }

  return [...byChannelId.values()].filter((candidate) => {
    const status = resolveChannelEnrichmentStatus({
      channelUpdatedAt: candidate.updatedAt,
      enrichment: candidate.enrichment,
    });

    // Cancellation is an explicit admin decision. Only a user-triggered manual
    // request may retry it; hourly sync must not silently resume provider use.
    return status === "missing" || status === "stale";
  });
}

/**
 * Make imported Almedia YouTube creators first-class catalog channels, then
 * feed a quota-conscious batch into the platform's existing durable pipeline.
 */
export async function prepareAlmediaYoutubeEnrichments(input: {
  preferredRequesterUserId?: string | null;
  batchSize?: number;
  campaigns?: readonly AlmediaCampaign[];
} = {}): Promise<PrepareAlmediaYoutubeEnrichmentsResult> {
  const requesterUserId = await resolveAlmediaEnrichmentRequester(
    input.preferredRequesterUserId,
  );
  const ingestedChannelCount = await ingestMissingAlmediaChannels(requesterUserId);
  const linkedEnrichmentCount = await relinkAlmediaEnrichmentCatalogChannels();
  let discoveredChannelCount = 0;
  let discoveryError: string | null = null;

  try {
    discoveredChannelCount = await discoverCampaignCatalogChannels(
      input.campaigns ?? [],
      requesterUserId,
    );
  } catch (error) {
    if (!(error instanceof YoutubeVideoChannelProviderError)) {
      throw error;
    }

    // Campaign snapshots are the primary sync payload. A quota/auth/network
    // outage pauses catalog discovery without leaving the workspace stale.
    discoveryError = error.message;
  }
  const candidates = await listEnrichmentCandidates();
  const batch = candidates.slice(0, normalizeBatchSize(input.batchSize));
  let queuedEnrichmentCount = 0;

  if (requesterUserId) {
    for (const candidate of batch) {
      // Do not swallow setup/queue failures: the surrounding Almedia sync owns a
      // durable status + lastError record and will persist the failed attempt.
      await requestChannelLlmEnrichment({
        channelId: candidate.channelId,
        requestedByUserId: requesterUserId,
      });
      queuedEnrichmentCount += 1;
    }
  }

  return {
    requesterUserId,
    discoveryError,
    ingestedChannelCount,
    discoveredChannelCount,
    linkedEnrichmentCount,
    queuedEnrichmentCount,
    pendingEnrichmentCount: Math.max(0, candidates.length - queuedEnrichmentCount),
  };
}
