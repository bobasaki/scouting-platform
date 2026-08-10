"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { totalsOf } from "../../../lib/almedia/filters";
import { formatCount, formatPct } from "../../../lib/almedia/format";

/**
 * Views vs realised views — where delivery stands against what the CPM pricing
 * promised, with the biggest under-deliverers called out.
 */
export function ViewsWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const totals = useMemo(() => totalsOf(deals), [deals]);
  const laggards = useMemo(
    () =>
      [...deals]
        .filter((deal) => deal.deliveryPct !== null && deal.expectedViews !== null)
        .sort((a, b) => (a.deliveryPct ?? 0) - (b.deliveryPct ?? 0))
        .slice(0, 4),
    [deals],
  );

  const delivery = totals.deliveryPct;
  const tone =
    delivery === null ? "neutral" : delivery >= 90 ? "good" : delivery >= 70 ? "warn" : "bad";

  return (
    <>
      <dl className="almedia-stat-row">
        <div className="almedia-stat">
          <dt>Expected views</dt>
          <dd>{formatCount(totals.expectedViews)}</dd>
        </div>
        <div className="almedia-stat">
          <dt>Realised views</dt>
          <dd>{formatCount(totals.actualViews)}</dd>
        </div>
        <div className="almedia-stat">
          <dt>Delivery</dt>
          <dd className={`almedia-text--${tone}`}>{formatPct(delivery)}</dd>
        </div>
      </dl>

      <div
        aria-label={`Delivery ${formatPct(delivery)}`}
        className="almedia-bar__track"
        role="img"
      >
        <i
          className={`almedia-bar__fill almedia-tone--${tone}`}
          style={{ width: `${Math.min(100, Math.max(2, delivery ?? 0))}%` }}
        />
      </div>

      {laggards.length > 0 ? (
        <div className="almedia-laggards">
          <p className="almedia-widget__subheading">Biggest under-deliverers</p>
          <ul>
            {laggards.map((deal) => (
              <li key={deal.campaignName ?? deal.channelKey}>
                <span>{deal.channelName}</span>
                <span className="almedia-text--bad">{formatPct(deal.deliveryPct)}</span>
                <em>
                  {formatCount(deal.viewCount)} of {formatCount(deal.expectedViews)}
                </em>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="almedia-widget__footnote">
        Expected views = cost ÷ expected CPM × 1000
      </p>
    </>
  );
}
