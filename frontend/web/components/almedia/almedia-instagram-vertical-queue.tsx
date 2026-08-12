"use client";

import {
  ALMEDIA_VERTICALS,
  type AlmediaDeal,
  type Booking,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import {
  createAlmediaBooking,
  updateAlmediaBooking,
} from "../../lib/almedia-api";
import { DataTable } from "../ui/DataTable";

type InstagramVerticalInputRow = Readonly<{
  channelKey: string;
  channelName: string;
  platform: string;
  country: string | null;
  videoUrl: string | null;
  campaignCount: number;
  bookingId: string | null;
}>;

/** One actionable row per creator, even when several campaign rounds need the value. */
export function instagramVerticalInputRows(
  deals: readonly AlmediaDeal[],
  bookings: readonly Booking[],
): InstagramVerticalInputRow[] {
  const bookingByChannelKey = new Map(
    bookings.map((booking) => [booking.channelKey, booking] as const),
  );
  const byChannelKey = new Map<string, InstagramVerticalInputRow>();

  for (const deal of deals) {
    if (!deal.needsVerticalInput) {
      continue;
    }

    const existing = byChannelKey.get(deal.channelKey);

    if (existing) {
      byChannelKey.set(deal.channelKey, {
        ...existing,
        campaignCount: existing.campaignCount + (deal.hasCampaign ? 1 : 0),
      });
      continue;
    }

    const booking = bookingByChannelKey.get(deal.channelKey);

    byChannelKey.set(deal.channelKey, {
      channelKey: deal.channelKey,
      channelName: deal.channelName,
      platform: deal.platform ?? "instagram",
      country: deal.country,
      videoUrl: deal.videoUrl,
      campaignCount: deal.hasCampaign ? 1 : 0,
      bookingId: booking?.id ?? null,
    });
  }

  return [...byChannelKey.values()].sort((left, right) =>
    left.channelName.localeCompare(right.channelName),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Unable to save the vertical.";
}

export function AlmediaInstagramVerticalQueue({
  bookings,
  deals,
  onMutated,
}: Readonly<{
  bookings: readonly Booking[];
  deals: readonly AlmediaDeal[];
  onMutated: () => void;
}>) {
  const rows = useMemo(
    () => instagramVerticalInputRows(deals, bookings),
    [bookings, deals],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return null;
  }

  function save(row: InstagramVerticalInputRow): void {
    const vertical = drafts[row.channelKey];

    if (!vertical || savingKey !== null) {
      return;
    }

    setSavingKey(row.channelKey);
    setError(null);

    const request = row.bookingId
      ? updateAlmediaBooking(row.bookingId, { vertical })
      : createAlmediaBooking({
          channelName: row.channelName,
          channelKey: row.channelKey,
          platform: row.platform,
          vertical,
          country: row.country,
          videoUrl: row.videoUrl,
        });

    void request
      .then(() => {
        setDrafts((current) => {
          const next = { ...current };
          delete next[row.channelKey];
          return next;
        });
        onMutated();
      })
      .catch((caught: unknown) => {
        setError(errorMessage(caught));
      })
      .finally(() => {
        setSavingKey(null);
      });
  }

  return (
    <section
      aria-labelledby="almedia-instagram-vertical-heading"
      className="almedia-vertical-input"
    >
      <div className="almedia-vertical-input__heading">
        <div>
          <p className="almedia-eyebrow">Manual classification needed</p>
          <h2 id="almedia-instagram-vertical-heading">
            Instagram channels need a vertical
          </h2>
        </div>
        <span className="almedia-vertical-input__count">{rows.length}</span>
      </div>
      <p className="almedia-vertical-input__description">
        Instagram channels cannot use the YouTube enrichment pipeline. Choose a
        vertical once per creator; it will be stored on the booking and used across
        every campaign round.
      </p>

      {error ? (
        <p className="almedia-sync-warning" role="alert">
          {error}
        </p>
      ) : null}

      <DataTable caption="Instagram creators waiting for a manual vertical">
        <thead>
          <tr>
            <th scope="col">Creator</th>
            <th scope="col">Market</th>
            <th className="almedia-numeric" scope="col">
              Campaigns
            </th>
            <th scope="col">Vertical</th>
            <th scope="col">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = drafts[row.channelKey] ?? "";
            const isSaving = savingKey === row.channelKey;

            return (
              <tr key={row.channelKey}>
                <td>
                  <strong>{row.channelName}</strong>
                  <span className="almedia-subnote">
                    Instagram · {row.channelKey}
                  </span>
                </td>
                <td>{row.country ?? "—"}</td>
                <td className="almedia-numeric">{row.campaignCount}</td>
                <td>
                  <select
                    aria-label={`Vertical for ${row.channelName}`}
                    disabled={savingKey !== null}
                    onChange={(event) => {
                      setDrafts((current) => ({
                        ...current,
                        [row.channelKey]: event.target.value,
                      }));
                    }}
                    value={selected}
                  >
                    <option value="">Choose vertical…</option>
                    {ALMEDIA_VERTICALS.map((vertical) => (
                      <option key={vertical} value={vertical}>
                        {vertical}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="workspace-button workspace-button--small"
                    disabled={!selected || savingKey !== null}
                    onClick={() => {
                      save(row);
                    }}
                    type="button"
                  >
                    {isSaving ? "Saving…" : "Save vertical"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </section>
  );
}
