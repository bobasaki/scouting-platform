"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { formatShare } from "../../../lib/almedia/format";

/** % of published content — booked deals that actually went live. */

export function PublishedWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const stats = useMemo(() => {
    const withStatus = deals.filter((deal) => deal.status !== null);
    const count = (statuses: readonly string[]): number =>
      withStatus.filter((deal) => statuses.includes(deal.status ?? "")).length;
    const live = count(["booked", "published", "longterm"]);
    const published = count(["published", "longterm"]);

    return {
      share: live > 0 ? published / live : null,
      published,
      booked: count(["booked"]),
      pipeline: count(["pipeline"]),
      dropped: count(["dropped"]),
      longterm: count(["longterm"]),
    };
  }, [deals]);

  const angle = (stats.share ?? 0) * 360;
  const tone =
    stats.share === null
      ? "neutral"
      : stats.share >= 0.7
        ? "good"
        : stats.share >= 0.4
          ? "warn"
          : "bad";

  return (
    <>
      <div className="almedia-published">
        <div
          aria-label={`${formatShare(stats.share)} of booked content published`}
          className={`almedia-donut almedia-donut--${tone}`}
          role="img"
          style={{ "--almedia-donut-angle": `${angle}deg` } as React.CSSProperties}
        >
          <strong>{formatShare(stats.share)}</strong>
          <span>published</span>
        </div>
        <ul className="almedia-published__legend">
          <li>
            <strong>{stats.published}</strong> published{" "}
            <em>({stats.longterm} longterm)</em>
          </li>
          <li>
            <strong>{stats.booked}</strong> booked, awaiting publication
          </li>
          <li>
            <strong>{stats.pipeline}</strong> in pipeline
          </li>
          <li>
            <strong>{stats.dropped}</strong> dropped
          </li>
        </ul>
      </div>
      <p className="almedia-widget__footnote">
        Published + longterm as a share of all booked deals
      </p>
    </>
  );
}
