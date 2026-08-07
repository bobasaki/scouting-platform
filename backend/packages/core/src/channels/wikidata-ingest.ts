import { ChannelCountrySource } from "@prisma/client";
import type {
  WikidataIngestChannel,
  WikidataIngestResponse,
} from "@scouting-platform/contracts";
import { withDbTransaction } from "@scouting-platform/db";

import { listDropdownOptions } from "../dropdown-values";
import { normalizeCountryRegionOption } from "../enrichment/country-resolution";

const YOUTUBE_CHANNEL_URL_PREFIX = "https://www.youtube.com/channel/";

export type IngestWikidataChannelsInput = {
  channels: readonly WikidataIngestChannel[];
};

/**
 * Collapse duplicate channel ids within a single batch, merging their country
 * lists so a channel discovered under several countries keeps every code.
 */
function dedupeBatch(
  channels: readonly WikidataIngestChannel[],
): Map<string, { label: string; countries: string[] }> {
  const byId = new Map<string, { label: string; countries: string[] }>();

  for (const channel of channels) {
    const existing = byId.get(channel.youtubeChannelId);

    if (existing) {
      existing.label = existing.label || channel.label;
      for (const code of channel.countries) {
        if (!existing.countries.includes(code)) {
          existing.countries.push(code);
        }
      }
      continue;
    }

    byId.set(channel.youtubeChannelId, {
      label: channel.label,
      countries: [...channel.countries],
    });
  }

  return byId;
}

/**
 * Pick the first country code that maps to a known catalog region option.
 * Returns null when none of the codes resolve (the channel is still ingested
 * as a seed — the country is simply left for enrichment to fill in later).
 */
function resolveCountryRegion(
  options: readonly string[],
  countries: readonly string[],
): string | null {
  for (const code of countries) {
    const match = normalizeCountryRegionOption(options, code);

    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Ingest a batch of Wikidata-discovered YouTube channels as seeds.
 *
 * - New channels are created with the Wikidata label as a provisional title
 *   and the resolved country (source = WIKIDATA).
 * - Existing channels are never overwritten with raw Wikidata data; only a
 *   previously-empty country is filled in. Real enriched titles, descriptions,
 *   thumbnails, and existing countries are left untouched.
 *
 * Idempotent: re-ingesting the same batch results in no changes (all skipped).
 */
export async function ingestWikidataChannels(
  input: IngestWikidataChannelsInput,
): Promise<WikidataIngestResponse> {
  const received = input.channels.length;
  const deduped = dedupeBatch(input.channels);

  // Channels dropped as within-batch duplicates count as skipped so the
  // returned tallies always sum back to `received`.
  let skipped = received - deduped.size;
  let created = 0;
  let updated = 0;

  const dropdownOptions = await listDropdownOptions();
  const countryOptions = dropdownOptions.countryRegion;

  await withDbTransaction(async (tx) => {
    const ids = [...deduped.keys()];
    const existing = await tx.channel.findMany({
      where: { youtubeChannelId: { in: ids } },
      select: { id: true, youtubeChannelId: true, countryRegion: true },
    });
    const existingByYoutubeId = new Map(existing.map((channel) => [channel.youtubeChannelId, channel]));

    const toCreate: {
      youtubeChannelId: string;
      title: string;
      youtubeUrl: string;
      countryRegion: string | null;
      countryRegionSource: ChannelCountrySource | null;
    }[] = [];

    for (const [youtubeChannelId, entry] of deduped) {
      const region = resolveCountryRegion(countryOptions, entry.countries);
      const found = existingByYoutubeId.get(youtubeChannelId);

      if (!found) {
        toCreate.push({
          youtubeChannelId,
          // Provisional title; enrichment replaces it with the real YouTube title.
          title: entry.label || youtubeChannelId,
          youtubeUrl: `${YOUTUBE_CHANNEL_URL_PREFIX}${youtubeChannelId}`,
          countryRegion: region,
          countryRegionSource: region ? ChannelCountrySource.WIKIDATA : null,
        });
        continue;
      }

      // Only backfill a missing country; never clobber existing channel data.
      if (region && !found.countryRegion) {
        await tx.channel.update({
          where: { id: found.id },
          data: {
            countryRegion: region,
            countryRegionSource: ChannelCountrySource.WIKIDATA,
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    if (toCreate.length > 0) {
      const result = await tx.channel.createMany({ data: toCreate, skipDuplicates: true });
      created = result.count;
      // Any rows lost to a concurrent insert were not created — count as skipped.
      skipped += toCreate.length - result.count;
    }
  });

  return { received, created, updated, skipped };
}
