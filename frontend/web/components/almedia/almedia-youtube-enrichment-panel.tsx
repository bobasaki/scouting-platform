"use client";

import type {
  AlmediaDeal,
  ChannelEnrichmentStatus,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { requestChannelEnrichmentBatch } from "../../lib/channels-api";

const ACTIONABLE_STATUSES: ReadonlySet<ChannelEnrichmentStatus> = new Set([
  "missing",
  "stale",
  "failed",
  "cancelled",
]);

type YoutubeEnrichmentRow = Readonly<{
  catalogChannelId: string;
  channelName: string;
  status: ChannelEnrichmentStatus;
}>;

export type YoutubeEnrichmentOverview = Readonly<{
  linked: number;
  ready: number;
  inProgress: number;
  needsEnrichment: number;
  unlinked: number;
  actionableRows: YoutubeEnrichmentRow[];
}>;

function isYoutube(platform: string | null): boolean {
  const normalized = platform?.trim().toLowerCase() ?? "";
  return normalized === "yt" || normalized.startsWith("youtube");
}

/** One status per catalog creator, regardless of campaign round count. */
export function youtubeEnrichmentOverview(
  deals: readonly AlmediaDeal[],
): YoutubeEnrichmentOverview {
  const linked = new Map<string, YoutubeEnrichmentRow>();
  const unlinked = new Set<string>();

  for (const deal of deals) {
    if (!isYoutube(deal.platform)) {
      continue;
    }

    if (!deal.catalogChannelId || !deal.catalogEnrichmentStatus) {
      unlinked.add(deal.channelKey);
      continue;
    }

    linked.set(deal.catalogChannelId, {
      catalogChannelId: deal.catalogChannelId,
      channelName: deal.channelName,
      status: deal.catalogEnrichmentStatus,
    });
  }

  const rows = [...linked.values()];
  const actionableRows = rows
    .filter((row) => ACTIONABLE_STATUSES.has(row.status))
    .sort((left, right) => left.channelName.localeCompare(right.channelName));

  return {
    linked: rows.length,
    ready: rows.filter((row) => row.status === "completed").length,
    inProgress: rows.filter(
      (row) => row.status === "queued" || row.status === "running",
    ).length,
    needsEnrichment: actionableRows.length,
    unlinked: unlinked.size,
    actionableRows,
  };
}

export function AlmediaYoutubeEnrichmentPanel({
  deals,
  onMutated,
}: Readonly<{
  deals: readonly AlmediaDeal[];
  onMutated: () => void;
}>) {
  const overview = useMemo(() => youtubeEnrichmentOverview(deals), [deals]);
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (overview.linked === 0 && overview.unlinked === 0) {
    return null;
  }

  function requestPending(): void {
    if (overview.actionableRows.length === 0 || isRequesting) {
      return;
    }

    setIsRequesting(true);
    setMessage(null);
    setIsError(false);

    void requestChannelEnrichmentBatch(
      overview.actionableRows.map((row) => row.catalogChannelId),
    )
      .then((results) => {
        const queued = results.filter((result) => result.ok).length;
        const failed = results.length - queued;

        setIsError(failed > 0);
        setMessage(
          failed > 0
            ? `Queued ${queued}; ${failed} could not be started.`
            : `Queued ${queued} YouTube ${queued === 1 ? "channel" : "channels"}.`,
        );
        onMutated();
      })
      .catch((error: unknown) => {
        setIsError(true);
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : "Unable to request YouTube enrichment.",
        );
      })
      .finally(() => {
        setIsRequesting(false);
      });
  }

  return (
    <section
      aria-labelledby="almedia-youtube-enrichment-heading"
      className="almedia-youtube-enrichment"
    >
      <div className="almedia-youtube-enrichment__heading">
        <div>
          <p className="almedia-eyebrow">Automatic creator intelligence</p>
          <h2 id="almedia-youtube-enrichment-heading">YouTube enrichment</h2>
        </div>
        <button
          className="workspace-button"
          disabled={overview.needsEnrichment === 0 || isRequesting}
          onClick={requestPending}
          type="button"
        >
          {isRequesting
            ? "Starting…"
            : `Enrich pending (${overview.needsEnrichment})`}
        </button>
      </div>

      <div className="almedia-youtube-enrichment__stats">
        <span><strong>{overview.ready}</strong> enriched</span>
        <span><strong>{overview.inProgress}</strong> in progress</span>
        <span><strong>{overview.needsEnrichment}</strong> pending</span>
        {overview.unlinked > 0 ? (
          <span><strong>{overview.unlinked}</strong> awaiting catalog link</span>
        ) : null}
      </div>
      <p className="almedia-youtube-enrichment__description">
        New linked YouTube creators are queued automatically in small hourly batches.
        Use the button to start every pending linked creator immediately with your
        assigned YouTube credential.
      </p>
      {message ? (
        <p
          className={isError ? "almedia-sync-warning" : "almedia-note"}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
