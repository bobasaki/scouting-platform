import {
  ChannelEnrichmentStatus as PrismaChannelEnrichmentStatus,
  CredentialProvider,
  type Prisma,
  Role,
} from "@prisma/client";
import { almediaChannelEnrichmentSchema } from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";

import { requestChannelLlmEnrichment } from "../enrichment";
import { resolveChannelEnrichmentStatus } from "../enrichment/status";
import { relinkAlmediaEnrichmentCatalogChannels } from "./enrichments";

const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/u;

export const ALMEDIA_AUTO_ENRICHMENT_BATCH_SIZE = 5;
export const ALMEDIA_AUTO_ENRICHMENT_MAX_BATCH_SIZE = 25;

export type PrepareAlmediaYoutubeEnrichmentsResult = Readonly<{
  requesterUserId: string | null;
  ingestedChannelCount: number;
  linkedEnrichmentCount: number;
  queuedEnrichmentCount: number;
  failedEnrichmentCount: number;
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
const credentialQueries = prisma.userProviderCredential as unknown as {
  findFirst(args: Prisma.UserProviderCredentialFindFirstArgs): Promise<UserIdRow | null>;
};
const syncRunQueries = prisma.almediaSyncRun as unknown as {
  findFirst(args: Prisma.AlmediaSyncRunFindFirstArgs): Promise<RecentRunRow | null>;
};
const almediaEnrichmentQueries = prisma.almediaChannelEnrichment as unknown as {
  findMany(
    args: Prisma.AlmediaChannelEnrichmentFindManyArgs,
  ): Promise<UnlinkedAlmediaEnrichmentRow[]>;
};
const channelIdQueries = prisma.channel as unknown as {
  findMany(args: Prisma.ChannelFindManyArgs): Promise<YoutubeChannelIdRow[]>;
};
const createdChannelQueries = prisma.channel as unknown as {
  findMany(args: Prisma.ChannelFindManyArgs): Promise<CreatedChannelRow[]>;
};
const catalogEnrichmentQueries = prisma.almediaChannelEnrichment as unknown as {
  findMany(
    args: Prisma.AlmediaChannelEnrichmentFindManyArgs,
  ): Promise<CatalogAlmediaEnrichmentRow[]>;
};
const channelMutations = prisma.channel as unknown as {
  createMany(args: Prisma.ChannelCreateManyArgs): Promise<unknown>;
};
const auditMutations = prisma.auditEvent as unknown as {
  createMany(args: Prisma.AuditEventCreateManyArgs): Promise<unknown>;
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
  const credential = await credentialQueries.findFirst({
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

  const recentRun = await syncRunQueries.findFirst({
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

  const fallback = await credentialQueries.findFirst({
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
  const unlinked = await almediaEnrichmentQueries.findMany({
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

  const existing = await channelIdQueries.findMany({
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

  await channelMutations.createMany({ data: missing, skipDuplicates: true });

  if (actorUserId) {
    const created = await createdChannelQueries.findMany({
      where: {
        youtubeChannelId: { in: missing.map((candidate) => candidate.youtubeChannelId) },
      },
      select: { id: true, youtubeChannelId: true },
    });

    if (created.length > 0) {
      await auditMutations.createMany({
        data: created.map((channel) => ({
          actorUserId,
          action: "almedia.channel.auto_ingested",
          entityType: "channel",
          entityId: channel.id,
          metadata: { youtubeChannelId: channel.youtubeChannelId },
        })),
      });
    }
  }

  return missing.length;
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
  const rows = await catalogEnrichmentQueries.findMany({
    where: { catalogChannelId: { not: null } },
    select: {
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
    },
  });
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

    return status === "missing" || status === "stale" || status === "cancelled";
  });
}

/**
 * Make imported Almedia YouTube creators first-class catalog channels, then
 * feed a quota-conscious batch into the platform's existing durable pipeline.
 */
export async function prepareAlmediaYoutubeEnrichments(input: {
  preferredRequesterUserId?: string | null;
  batchSize?: number;
} = {}): Promise<PrepareAlmediaYoutubeEnrichmentsResult> {
  const requesterUserId = await resolveAlmediaEnrichmentRequester(
    input.preferredRequesterUserId,
  );
  const ingestedChannelCount = await ingestMissingAlmediaChannels(requesterUserId);
  const linkedEnrichmentCount = await relinkAlmediaEnrichmentCatalogChannels();
  const candidates = await listEnrichmentCandidates();
  const batch = candidates.slice(0, normalizeBatchSize(input.batchSize));
  let queuedEnrichmentCount = 0;
  let failedEnrichmentCount = 0;

  if (requesterUserId) {
    for (const candidate of batch) {
      try {
        await requestChannelLlmEnrichment({
          channelId: candidate.channelId,
          requestedByUserId: requesterUserId,
        });
        queuedEnrichmentCount += 1;
      } catch {
        failedEnrichmentCount += 1;
      }
    }
  }

  return {
    requesterUserId,
    ingestedChannelCount,
    linkedEnrichmentCount,
    queuedEnrichmentCount,
    failedEnrichmentCount,
    pendingEnrichmentCount: Math.max(0, candidates.length - queuedEnrichmentCount),
  };
}
