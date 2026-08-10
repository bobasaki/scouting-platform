"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { maturityMix } from "../../../lib/almedia/charts";
import { formatEur, formatPct } from "../../../lib/almedia/format";
import { returnTone } from "./bar-list";

/**
 * Maturity mix — matured vs still-accruing spend. Almedia gives a single return
 * snapshot, not a maturation curve, so this is the honest guardrail: a matured
 * return can be acted on; a maturing one is incomplete and shouldn't be judged.
 */
export function MaturityWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const mix = useMemo(() => maturityMix(deals), [deals]);
  const total = mix.matured.deals + mix.maturing.deals + mix.unknown.deals;

  if (total === 0) {
    return (
      <p className="almedia-widget__empty">
        No live campaigns for the current filters.
      </p>
    );
  }

  const totalCost = mix.matured.cost + mix.maturing.cost + mix.unknown.cost;
  const segments = [
    { key: "matured", label: "Matured", bucket: mix.matured, tone: "good" },
    { key: "maturing", label: "Maturing", bucket: mix.maturing, tone: "warn" },
    { key: "unknown", label: "No date", bucket: mix.unknown, tone: "neutral" },
  ];

  return (
    <>
      <div aria-label="Spend by maturity" className="almedia-maturity-bar" role="img">
        {segments.map((segment) =>
          segment.bucket.cost <= 0 || totalCost <= 0 ? null : (
            <i
              className={`almedia-maturity-bar__seg almedia-tone--${segment.tone}`}
              key={segment.key}
              style={{ width: `${(segment.bucket.cost / totalCost) * 100}%` }}
              title={`${segment.label}: ${formatEur(segment.bucket.cost)} · ${segment.bucket.deals} deals`}
            />
          ),
        )}
      </div>

      <dl className="almedia-stat-row">
        <div className="almedia-stat">
          <dt>Matured return</dt>
          <dd className={`almedia-text--${returnTone(mix.matured.avgReturnPct)}`}>
            {formatPct(mix.matured.avgReturnPct)}
          </dd>
        </div>
        <div className="almedia-stat">
          <dt>Maturing return</dt>
          <dd className={`almedia-text--${returnTone(mix.maturing.avgReturnPct)}`}>
            {formatPct(mix.maturing.avgReturnPct)}
          </dd>
        </div>
        <div className="almedia-stat">
          <dt>Matured deals</dt>
          <dd>{mix.matured.deals}</dd>
        </div>
        <div className="almedia-stat">
          <dt>Maturing deals</dt>
          <dd>{mix.maturing.deals}</dd>
        </div>
      </dl>

      <p className="almedia-widget__footnote">
        Matured = 14+ days since publish · maturing returns are still accruing, judge
        them later
      </p>
    </>
  );
}
