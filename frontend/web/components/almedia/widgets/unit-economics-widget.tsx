"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { unitEconomics } from "../../../lib/almedia/charts";
import {
  formatCount,
  formatAmount,
  formatAmountPrecise,
  formatPct,
} from "../../../lib/almedia/format";

/**
 * Unit economics — the CPA cost view. Realised vs expected eCPM shows delivery
 * quality; cost per signup / D7 purchase shows what acquisition actually costs.
 * These are unit costs, not a nested funnel: Almedia's signup and purchase
 * figures are independently modeled, so we never chain them into conversions.
 */
export function UnitEconomicsWidget({
  deals,
}: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const metrics = useMemo(() => unitEconomics(deals), [deals]);

  if (metrics.measuredCampaigns === 0) {
    return (
      <p className="almedia-widget__empty">
        No live campaign metrics for the current filters.
      </p>
    );
  }

  const cpmScale = Math.max(metrics.realisedCpm ?? 0, metrics.expectedCpm ?? 0, 1);
  const cpmBars = [
    { label: "Expected CPM", value: metrics.expectedCpm, tone: "neutral" },
    { label: "Realised eCPM", value: metrics.realisedCpm, tone: "good" },
  ];

  return (
    <>
      <p className="almedia-widget__subheading">CPM · priced vs delivered</p>
      <ul className="almedia-bar-list">
        {cpmBars.map((bar) => (
          <li className="almedia-bar" key={bar.label}>
            <p className="almedia-bar__heading">
              <span className="almedia-bar__label">{bar.label}</span>
              <span className="almedia-bar__value">{formatAmount(bar.value)}</span>
            </p>
            <div aria-hidden="true" className="almedia-bar__track">
              <i
                className={`almedia-bar__fill almedia-tone--${bar.tone}`}
                style={{ width: `${Math.max(2, ((bar.value ?? 0) / cpmScale) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <dl className="almedia-stat-row">
        <div className="almedia-stat">
          <dt>Signup rate</dt>
          <dd>
            {formatPct(
              metrics.signupRate === null ? null : metrics.signupRate * 100,
              2,
            )}
          </dd>
        </div>
        <div className="almedia-stat">
          <dt>Cost / signup</dt>
          <dd>{formatAmount(metrics.costPerSignup)}</dd>
        </div>
        <div className="almedia-stat">
          <dt>Cost / D7 purchase</dt>
          <dd>{formatAmount(metrics.costPerPurchase)}</dd>
        </div>
        <div className="almedia-stat">
          <dt>D7 purchases</dt>
          <dd>{formatCount(metrics.d7Purchases)}</dd>
        </div>
        <div className="almedia-stat">
          <dt>APPU · D14</dt>
          <dd>{formatAmountPrecise(metrics.appuD14)}</dd>
        </div>
      </dl>
      <p className="almedia-widget__footnote">
        {metrics.measuredCampaigns} campaigns with view data ·{" "}
        {formatCount(metrics.views)} views · signups &amp; purchases are Almedia-modeled
      </p>
    </>
  );
}
