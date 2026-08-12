import type {
  AlmediaCreatorVerticalOverrideResponse,
  AlmediaVertical,
} from "@scouting-platform/contracts";
import { prisma, withDbTransaction } from "@scouting-platform/db";

import { recordAuditEvent } from "../audit";
import { ServiceError } from "../errors";
import { requireAlmediaAdminUser } from "./access";
import { normalizeChannelKey } from "./channel-key";
import { canonicalVertical } from "./verticals";

export type AlmediaVerticalOverrideLookup = ReadonlyMap<string, AlmediaVertical>;

/** Load admin-manual creator classifications for the Insights deal join. */
export async function loadAlmediaVerticalOverrides(): Promise<AlmediaVerticalOverrideLookup> {
  const rows = await prisma.almediaVerticalOverride.findMany({
    select: { channelKey: true, vertical: true },
  });
  const overrides = new Map<string, AlmediaVertical>();

  for (const row of rows) {
    const vertical = canonicalVertical(row.vertical);

    if (vertical) {
      overrides.set(row.channelKey, vertical);
    }
  }

  return overrides;
}

/**
 * Set one admin-manual classification for an Almedia creator. This is not a
 * Booking write: API campaigns are completed integrations, while bookings
 * represent potential future work.
 */
export async function setAlmediaCreatorVerticalOverride(input: {
  requestedByUserId: string;
  channelKey: string;
  vertical: AlmediaVertical;
}): Promise<AlmediaCreatorVerticalOverrideResponse> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const channelKey = normalizeChannelKey(input.channelKey);
  const vertical = canonicalVertical(input.vertical);

  if (!channelKey) {
    throw new ServiceError(
      "ALMEDIA_VERTICAL_OVERRIDE_CHANNEL_KEY_EMPTY",
      422,
      "Creator key must contain at least one letter or digit",
    );
  }

  if (!vertical) {
    throw new ServiceError(
      "ALMEDIA_VERTICAL_OVERRIDE_INVALID",
      422,
      "Vertical must use the Almedia vocabulary",
    );
  }

  return withDbTransaction(async (tx) => {
    const existing = await tx.almediaVerticalOverride.findUnique({
      where: { channelKey },
      select: { id: true, vertical: true },
    });
    const saved = await tx.almediaVerticalOverride.upsert({
      where: { channelKey },
      create: {
        channelKey,
        vertical,
        createdByUserId: input.requestedByUserId,
        updatedByUserId: input.requestedByUserId,
      },
      update: {
        vertical,
        updatedByUserId: input.requestedByUserId,
      },
      select: { id: true, channelKey: true, vertical: true },
    });

    await recordAuditEvent(
      {
        actorUserId: input.requestedByUserId,
        action: "almedia.creator_vertical.updated",
        entityType: "almedia_creator_vertical_override",
        entityId: saved.id,
        metadata: {
          channelKey,
          previousVertical: existing?.vertical ?? null,
          vertical,
        },
      },
      tx,
    );

    return { channelKey: saved.channelKey, vertical };
  });
}
