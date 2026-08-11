"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { returnDistribution } from "../../../lib/almedia/charts";
import { formatAmount, formatPct } from "../../../lib/almedia/format";

/**
 * Return distribution — how the measured portfolio spreads across the decision
 * tiers. A count histogram with the spend sitting in each band, so a lot of
 * deals in a thin-return band reads differently from a lot of money there.
 */
export function ReturnDistributionWidget({
  deals,
}: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const { bands, measured, medianReturnPct } = useMemo(
    () => returnDistribution(deals),
    [deals],
  );

  if (measured === 0) {
    return (
      <p className="almedia-widget__empty">
        No measured returns yet for the current filters.
      </p>
    );
  }

  const maxDeals = Math.max(1, ...bands.map((band) => band.deals));

  return (
    <>
      <div
        aria-label="Return distribution by tier"
        className="almedia-histogram"
        role="img"
      >
        {bands.map((band) => (
          <div className="almedia-histogram__col" key={band.label}>
            <span className="almedia-histogram__count">{band.deals}</span>
            <div className="almedia-histogram__track">
              <i
                className={`almedia-histogram__bar almedia-tone--${band.tone}`}
                style={{ height: `${(band.deals / maxDeals) * 100}%` }}
              />
            </div>
            <span className="almedia-histogram__label">{band.label}</span>
            <span className="almedia-histogram__meta">{formatAmount(band.cost)}</span>
          </div>
        ))}
      </div>
      <p className="almedia-widget__footnote">
        {measured} measured deals · median return {formatPct(medianReturnPct)} · bars are
        deal count, figure below is spend in the band
      </p>
    </>
  );
}
