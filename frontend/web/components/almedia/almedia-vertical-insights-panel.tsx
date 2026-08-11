"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { enrichmentOverview, verticalPerformance } from "../../lib/almedia/enrichment";
import {
  formatCount,
  formatEur,
  formatPct,
  formatShare,
} from "../../lib/almedia/format";
import type { VerticalPerformance } from "../../lib/almedia/types";
import { DataTable } from "../ui/DataTable";
import { AlmediaInfoTip } from "./almedia-info-tip";

/**
 * Vertical performance — the enrichment layer of the Insights tab. Verticals are
 * derived from what each creator actually publishes, so this compares niches on
 * equal terms rather than on whatever the booking form happened to say.
 *
 * Ported from the standalone tracker's `VerticalInsightsPanel`.
 */

const SORT_MODES = [
  { id: "spend", label: "Spend" },
  { id: "return", label: "Return" },
  { id: "engagement", label: "Engagement" },
] as const;

type SortMode = (typeof SORT_MODES)[number]["id"];

/** The most verticals worth comparing at a glance; the tail is a long one. */
const MAX_ROWS = 12;

function returnTone(value: number | null): string {
  if (value === null) return "neutral";
  if (value > 100) return "good";
  if (value >= 80) return "neutral";
  if (value >= 50) return "warn";

  return "bad";
}

function sortRows(
  rows: readonly VerticalPerformance[],
  mode: SortMode,
): VerticalPerformance[] {
  return [...rows].sort((left, right) => {
    if (mode === "return") {
      return (right.avgReturnPct ?? -1) - (left.avgReturnPct ?? -1);
    }

    if (mode === "engagement") {
      return (right.avgEngagementRatePct ?? -1) - (left.avgEngagementRatePct ?? -1);
    }

    return right.cost - left.cost;
  });
}

type AlmediaVerticalInsightsPanelProps = Readonly<{
  deals: readonly AlmediaDeal[];
  onSelectVertical: (vertical: string) => void;
}>;

export function AlmediaVerticalInsightsPanel({
  deals,
  onSelectVertical,
}: AlmediaVerticalInsightsPanelProps) {
  const [sort, setSort] = useState<SortMode>("spend");
  const overview = useMemo(() => enrichmentOverview(deals), [deals]);
  const rows = useMemo(
    () => sortRows(verticalPerformance(deals), sort).slice(0, MAX_ROWS),
    [deals, sort],
  );

  return (
    <section
      aria-labelledby="almedia-vertical-insights-heading"
      className="almedia-verticals"
    >
      <header className="almedia-verticals__header">
        <div className="almedia-verticals__title">
          <p className="almedia-eyebrow">Enrichment intelligence</p>
          <h2 id="almedia-vertical-insights-heading">Which verticals pay off?</h2>
        </div>
        <div className="almedia-verticals__header-actions">
          <div
            aria-label="Sort verticals"
            className="almedia-segmented"
            role="group"
          >
            {SORT_MODES.map((mode) => (
              <button
                aria-pressed={sort === mode.id}
                className="almedia-segmented__option"
                key={mode.id}
                onClick={() => {
                  setSort(mode.id);
                }}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>
          <AlmediaInfoTip align="end" label="What the vertical panel shows">
            <p>
              <strong>Verticals derived from creator content</strong>, not from the
              booking form. Each creator&apos;s enrichment (niche, topics, keywords)
              is scored against a fixed vocabulary, so two CMs cannot label the same
              niche differently.
            </p>
            <ul>
              <li>
                <span className="almedia-info-tip__term">Coverage</span>: share of
                campaigns in view with an enriched creator behind them. Uncovered
                campaigns fall back to the booking&apos;s own vertical.
              </li>
              <li>
                <span className="almedia-info-tip__term">Engagement</span> and{" "}
                <span className="almedia-info-tip__term">low risk</span> are averaged
                per creator, so a channel booked four times counts once.
              </li>
              <li>
                A campaign can sit in two verticals; it is counted in both.
              </li>
            </ul>
          </AlmediaInfoTip>
        </div>
      </header>

      <div className="almedia-verticals__overview">
        <article className="almedia-verticals__stat">
          <span>Enrichment coverage</span>
          <strong>{formatShare(overview.coverageShare)}</strong>
          <small>
            {overview.enrichedCampaigns} of {overview.campaigns} campaigns
          </small>
        </article>
        <article className="almedia-verticals__stat">
          <span>Verticals in play</span>
          <strong>{overview.verticals}</strong>
          <small>up to two per campaign</small>
        </article>
        <article className="almedia-verticals__stat">
          <span>Avg engagement</span>
          <strong>{formatPct(overview.avgEngagementRatePct, 1)}</strong>
          <small>
            across {overview.enrichedCreators}{" "}
            {overview.enrichedCreators === 1 ? "creator" : "creators"}
          </small>
        </article>
        <article className="almedia-verticals__stat">
          <span>Low safety risk</span>
          <strong>{formatShare(overview.brandSafeShare)}</strong>
          <small>of assessed creators</small>
        </article>
      </div>

      {rows.length === 0 ? (
        <p className="almedia-verticals__empty">
          No campaigns in view carry a vertical yet. Enrichment arrives with the
          creator; bookings without one fall back to their own vertical field.
        </p>
      ) : (
        <DataTable caption="Commercial performance and creator quality per vertical">
          <thead>
            <tr>
              <th scope="col">Vertical</th>
              <th className="almedia-numeric" scope="col">
                Campaigns
              </th>
              <th className="almedia-numeric" scope="col">
                Spend
              </th>
              <th className="almedia-numeric" scope="col">
                Return
              </th>
              <th className="almedia-numeric" scope="col">
                Views
              </th>
              <th className="almedia-numeric" scope="col">
                D7 purchases
              </th>
              <th className="almedia-numeric" scope="col">
                Engagement
              </th>
              <th className="almedia-numeric" scope="col">
                Low risk
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.vertical}>
                <td>
                  <button
                    className="almedia-verticals__filter"
                    onClick={() => {
                      onSelectVertical(row.vertical);
                    }}
                    title={`Filter every insight to ${row.vertical}`}
                    type="button"
                  >
                    {row.vertical}
                  </button>
                </td>
                <td className="almedia-numeric">{row.campaigns}</td>
                <td className="almedia-numeric almedia-numeric--emphasis">
                  {formatEur(row.cost)}
                </td>
                <td
                  className={`almedia-numeric almedia-tone-${returnTone(row.avgReturnPct)}`}
                >
                  {formatPct(row.avgReturnPct)}
                  {row.measuredReturns === 0 ? null : (
                    <span className="almedia-subnote">
                      {row.measuredReturns} measured
                    </span>
                  )}
                </td>
                <td className="almedia-numeric">{formatCount(row.views)}</td>
                <td className="almedia-numeric">{formatCount(row.d7Purchases)}</td>
                <td className="almedia-numeric">
                  {formatPct(row.avgEngagementRatePct, 1)}
                </td>
                <td className="almedia-numeric">{formatShare(row.brandSafeShare)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <p className="almedia-verticals__note">
        Select a vertical to filter every widget below. Multi-vertical campaigns are
        included in each of their verticals.
      </p>
    </section>
  );
}
