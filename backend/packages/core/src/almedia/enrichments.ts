import process from "node:process";

import type { AlmediaChannelEnrichment } from "@scouting-platform/contracts";
import { almediaChannelEnrichmentSchema } from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";

import { campaignBaseKey } from "./channel-key";
import { resolveChannelEnrichmentStatus } from "../enrichment/status";

/**
 * Channel enrichments: what the tracker's enrichment service knows about each
 * creator (audience size, typical performance, niche, brand fit and safety).
 *
 * A campaign resolves to an enrichment through a link row. Two link types
 * exist, and the order matters: an exact `campaign` link is the creator that
 * campaign was enriched for, while the `channel_key` link is the creator behind
 * every campaign variant (`_R2`, `_LB`) added after that enrichment ran. Exact
 * first, normalized key as the fallback.
 */

export const ALMEDIA_ENRICHMENT_LINK_TYPES = {
  campaign: "campaign",
  channelKey: "channel_key",
} as const;

export type AlmediaEnrichmentLookupValue = Readonly<{
  enrichment: AlmediaChannelEnrichment;
  catalogChannelId: string | null;
  catalogEnrichmentStatus: ReturnType<typeof resolveChannelEnrichmentStatus> | null;
  catalogInfluencerVertical: string | null;
}>;

/**
 * Enrichments indexed by link, ready for the deal join. Built once per request
 * rather than queried per campaign — the whole table is a few hundred rows.
 */
export interface AlmediaEnrichmentLookup {
  /** Exact Almedia campaign name -> enrichment. */
  readonly byCampaign: ReadonlyMap<string, AlmediaEnrichmentLookupValue>;
  /** Normalized creator key -> enrichment. */
  readonly byChannelKey: ReadonlyMap<string, AlmediaEnrichmentLookupValue>;
}

export const EMPTY_ALMEDIA_ENRICHMENT_LOOKUP: AlmediaEnrichmentLookup = {
  byCampaign: new Map(),
  byChannelKey: new Map(),
};

/**
 * Resolve the enrichment behind a campaign: its own, else the creator's.
 * A campaign with neither link has no enrichment on file.
 */
export function findCampaignEnrichment(
  lookup: AlmediaEnrichmentLookup,
  campaignName: string,
): AlmediaEnrichmentLookupValue | null {
  return (
    lookup.byCampaign.get(campaignName) ??
    lookup.byChannelKey.get(campaignBaseKey(campaignName)) ??
    null
  );
}

/** Resolve the enrichment for a booking that has no campaign yet. */
export function findChannelEnrichment(
  lookup: AlmediaEnrichmentLookup,
  channelKey: string,
): AlmediaEnrichmentLookupValue | null {
  return lookup.byChannelKey.get(channelKey) ?? null;
}

/**
 * Load every stored enrichment and index it by its links.
 *
 * A document that no longer satisfies the projection is skipped rather than
 * failing the request: enrichments are produced by a separate service, and one
 * malformed row should cost that creator's signals, not the whole workspace.
 */
export async function loadAlmediaEnrichmentLookup(): Promise<AlmediaEnrichmentLookup> {
  const rows = await prisma.almediaChannelEnrichment.findMany({
    select: {
      channelId: true,
      catalogChannelId: true,
      result: true,
      links: { select: { sourceType: true, sourceKey: true } },
      catalogChannel: {
        select: {
          updatedAt: true,
          influencerVertical: true,
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

  const byCampaign = new Map<string, AlmediaEnrichmentLookupValue>();
  const byChannelKey = new Map<string, AlmediaEnrichmentLookupValue>();
  let skipped = 0;

  for (const row of rows) {
    const parsed = almediaChannelEnrichmentSchema.safeParse(row.result);

    if (!parsed.success) {
      skipped += 1;
      continue;
    }

    for (const link of row.links) {
      const target =
        link.sourceType === ALMEDIA_ENRICHMENT_LINK_TYPES.campaign
          ? byCampaign
          : link.sourceType === ALMEDIA_ENRICHMENT_LINK_TYPES.channelKey
            ? byChannelKey
            : null;

      target?.set(link.sourceKey, {
        enrichment: parsed.data,
        catalogChannelId: row.catalogChannelId,
        catalogEnrichmentStatus: row.catalogChannel
          ? resolveChannelEnrichmentStatus({
              channelUpdatedAt: row.catalogChannel.updatedAt,
              enrichment: row.catalogChannel.enrichment,
            })
          : null,
        catalogInfluencerVertical:
          row.catalogChannel?.influencerVertical ?? null,
      });
    }
  }

  if (skipped > 0) {
    process.stderr.write(
      `[almedia] skipped ${skipped} channel enrichment(s) that no longer match the expected shape\n`,
    );
  }

  return { byCampaign, byChannelKey };
}

/** Link enrichments to catalog channels that appeared since the last import. Idempotent. */
export async function relinkAlmediaEnrichmentCatalogChannels(): Promise<number> {
  return prisma.$executeRaw`
    UPDATE almedia_channel_enrichments a
    SET catalog_channel_id = c.id
    FROM channels c
    WHERE c.youtube_channel_id = a.channel_id
      AND a.catalog_channel_id IS NULL
  `;
}
