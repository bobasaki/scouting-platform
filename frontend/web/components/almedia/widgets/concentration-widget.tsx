"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { spendConcentration } from "../../../lib/almedia/charts";
import { formatEur, formatShare } from "../../../lib/almedia/format";

/**
 * Spend concentration (Pareto) — how much of the budget rides on a handful of
 * channels. A dependency-risk read: the cumulative line climbing steeply means
 * a few creators carry the portfolio.
 */
export function ConcentrationWidget({
  deals,
}: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const { rows, othersCost, totalCost, topShare } = useMemo(
    () => spendConcentration(deals, 10),
    [deals],
  );

  if (rows.length === 0) {
    return (
      <p className="almedia-widget__empty">
        No campaign spend for the current filters.
      </p>
    );
  }

  const maxShare = Math.max(...rows.map((row) => row.share));

  return (
    <>
      <p className="almedia-widget__lead">
        Top {rows.length} channels carry <strong>{formatShare(topShare)}</strong> of{" "}
        {formatEur(totalCost)} spend
      </p>
      <ul className="almedia-bar-list">
        {rows.map((row) => (
          <li className="almedia-bar" key={row.channelName}>
            <p className="almedia-bar__heading">
              <span className="almedia-bar__label">{row.channelName}</span>
              <span className="almedia-bar__value">
                {formatShare(row.share)}
                <em>{formatEur(row.cost)}</em>
              </span>
            </p>
            <div aria-hidden="true" className="almedia-bar__track">
              <i
                className="almedia-bar__fill almedia-tone--neutral"
                style={{ width: `${Math.max(2, (row.share / maxShare) * 100)}%` }}
              />
              <i
                className="almedia-bar__cumulative"
                style={{ left: `${row.cumulativeShare * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {othersCost > 0 ? (
        <p className="almedia-widget__footnote">
          + {formatEur(othersCost)} across the remaining channels · tick marks show
          cumulative share
        </p>
      ) : null}
    </>
  );
}
