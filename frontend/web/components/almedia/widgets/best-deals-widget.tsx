"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { bestDealsByCm } from "../../../lib/almedia/filters";
import { formatAmount, formatPct } from "../../../lib/almedia/format";

/** Per-CM leaderboard: who is landing the best-returning deals right now. */

function leaderTone(avgReturnPct: number | null): string {
  const value = avgReturnPct ?? 0;

  if (value >= 100) return "good";
  if (value >= 50) return "warn";

  return "bad";
}

export function BestDealsWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const leaderboard = useMemo(() => bestDealsByCm(deals, 3), [deals]);

  if (leaderboard.length === 0) {
    return (
      <p className="almedia-widget__empty">
        No measured deals for the current filters.
      </p>
    );
  }

  return (
    <>
      <ol className="almedia-leaderboard">
        {leaderboard.map(({ cm, avgReturnPct, deals: top }, index) => (
          <li key={cm}>
            <p className="almedia-leaderboard__row">
              <span className="almedia-leaderboard__rank">{index + 1}</span>
              <strong className="almedia-leaderboard__name">{cm}</strong>
              <span className={`almedia-text--${leaderTone(avgReturnPct)}`}>
                {formatPct(avgReturnPct)} avg
              </span>
            </p>
            <ul className="almedia-leaderboard__deals">
              {top.map((deal) => (
                <li key={deal.campaignName ?? deal.channelKey}>
                  {deal.videoUrl ? (
                    <a
                      href={deal.videoUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      title="Open published video"
                    >
                      {deal.channelName} ↗
                    </a>
                  ) : (
                    <span>{deal.channelName}</span>
                  )}
                  <em>
                    {deal.country ?? "–"} · {formatAmount(deal.cost)}
                  </em>
                  <span className="almedia-leaderboard__return">
                    {formatPct(deal.returnPct)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="almedia-widget__footnote">
        Ranked by cost-weighted return across measured campaigns
      </p>
    </>
  );
}
