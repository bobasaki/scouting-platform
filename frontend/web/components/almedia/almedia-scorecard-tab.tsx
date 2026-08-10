"use client";

import type {
  AlmediaScorecardResponse,
  AlmediaScorecardRow,
  AlmediaTierCounts,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { formatEurCompact, formatShare } from "../../lib/almedia/format";
import { monthLabel } from "../../lib/almedia/labels";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { AlmediaInfoTip } from "./almedia-info-tip";

/**
 * Scorecard tab — committed budget (booked, published, longterm) against each
 * CM's monthly plan target. Ported from the standalone tracker's ScorecardView.
 */

const TIER_LABELS: ReadonlyArray<{ key: keyof AlmediaTierCounts; label: string }> = [
  { key: "under10k", label: "<10k" },
  { key: "from10kTo20k", label: "10–20k" },
  { key: "from20kTo50k", label: "20–50k" },
  { key: "over50k", label: "50k+" },
];

function paceBadge(pace: number | null): { modifier: string; label: string } | null {
  if (pace === null) {
    return null;
  }

  if (pace >= 1) {
    return { modifier: "ahead", label: `${formatShare(pace)} pace · on track` };
  }

  if (pace >= 0.75) {
    return { modifier: "close", label: `${formatShare(pace)} pace` };
  }

  return { modifier: "behind", label: `${formatShare(pace)} pace · behind` };
}

function ProgressBar({ utilization }: Readonly<{ utilization: number | null }>) {
  if (utilization === null) {
    return (
      <div
        aria-hidden="true"
        className="almedia-progress almedia-progress--untargeted"
      />
    );
  }

  return (
    <div aria-hidden="true" className="almedia-progress">
      <span
        className={
          utilization >= 1
            ? "almedia-progress__fill almedia-progress__fill--done"
            : "almedia-progress__fill"
        }
        style={{ width: `${Math.min(1, utilization) * 100}%` }}
      />
    </div>
  );
}

function TierChips({ row }: Readonly<{ row: AlmediaScorecardRow }>) {
  const targetTiers = row.targetTiers;

  if (!targetTiers) {
    return <span className="almedia-tier-note">no plan</span>;
  }

  return (
    <span className="almedia-tier-chips">
      {TIER_LABELS.map(({ key, label }) => {
        const planned = targetTiers[key];
        const booked = row.bookedTiers[key];

        if (planned === 0 && booked === 0) {
          return null;
        }

        return (
          <span
            className={
              booked >= planned ? "almedia-chip almedia-chip--done" : "almedia-chip"
            }
            key={key}
            title={`${label}: ${booked} booked of ${planned} planned`}
          >
            {label} {booked}/{planned}
          </span>
        );
      })}
    </span>
  );
}

function currentIsoMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function AlmediaScorecardTab({
  scorecard,
}: Readonly<{ scorecard: AlmediaScorecardResponse }>) {
  const monthOptions = useMemo(
    () => [...new Set(scorecard.rows.map((row) => row.month))].sort(),
    [scorecard.rows],
  );
  // Default to the current month when it has rows, as the source view did.
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const current = currentIsoMonth();

    return monthOptions.includes(current) ? current : "all";
  });
  const rows = useMemo(
    () =>
      scorecard.rows.filter((row) => monthFilter === "all" || row.month === monthFilter),
    [scorecard.rows, monthFilter],
  );

  return (
    <div className="almedia-scorecard">
      <div className="almedia-section-heading">
        <h2>Are we on pace?</h2>
        <AlmediaInfoTip align="start" label="What the Scorecard tab shows">
          <p>
            <strong>Committed budget against the plan</strong> for every CM, market, and
            month. It answers one question: are we on track to hit target?
          </p>
          <ul>
            <li>
              <span className="almedia-info-tip__term">Utilisation</span>: booked ÷
              target. 100% means the target is met.
            </li>
            <li>
              <span className="almedia-info-tip__term">Pace</span>: progress against
              where we should be by now. &quot;Behind&quot; means catch-up is needed.
            </li>
            <li>
              <span className="almedia-info-tip__term">Committed</span> is booked plus
              published plus longterm.{" "}
              <span className="almedia-info-tip__term">Dropout</span> is the share of
              deals that fell through.
            </li>
          </ul>
        </AlmediaInfoTip>
      </div>

      {scorecard.months.length === 0 ? (
        <EmptyState
          description="No plan targets or dated bookings have been imported yet."
          title="Nothing to score yet"
        />
      ) : (
        <section aria-label="Monthly totals" className="almedia-month-grid">
          {scorecard.months.map((month) => {
            const badge = paceBadge(month.pace);

            return (
              <article className="almedia-month-card" key={month.month}>
                <p className="almedia-eyebrow">{monthLabel(month.month)}</p>
                <strong className="almedia-month-card__value">
                  {formatEurCompact(month.bookedEur)}
                  <span> / {formatEurCompact(month.targetEur)}</span>
                </strong>
                <ProgressBar utilization={month.utilization} />
                <p className="almedia-month-card__meta">
                  {formatShare(month.utilization)} of target
                  {month.dropoutRate !== null
                    ? ` · ${formatShare(month.dropoutRate)} dropout`
                    : null}
                  {month.counts.pipeline > 0
                    ? ` · ${month.counts.pipeline} in pipeline`
                    : null}
                </p>
                {badge ? (
                  <span className={`almedia-pace almedia-pace--${badge.modifier}`}>
                    {badge.label}
                  </span>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      {scorecard.unscheduledCount > 0 ? (
        <p className="almedia-note" role="note">
          {scorecard.unscheduledCount} booking
          {scorecard.unscheduledCount === 1 ? "" : "s"} have no target month and are not
          counted here.
        </p>
      ) : null}

      <section className="almedia-panel">
        <div className="almedia-panel__heading">
          <div>
            <p className="almedia-eyebrow">Breakdown</p>
            <h3>CM × market targets</h3>
          </div>
          <label className="almedia-field">
            <span>Month</span>
            <select
              onChange={(event) => {
                setMonthFilter(event.target.value);
              }}
              value={monthFilter}
            >
              <option value="all">All months</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            description="No plan rows match the selected month."
            title="No rows for this month"
          />
        ) : (
          <DataTable caption="Booked versus plan target per CM, market, and month">
            <thead>
              <tr>
                <th scope="col">CM</th>
                <th scope="col">Market</th>
                <th scope="col">Month</th>
                <th className="almedia-numeric" scope="col">
                  Booked
                </th>
                <th className="almedia-numeric" scope="col">
                  Target
                </th>
                <th scope="col">Progress</th>
                <th scope="col">Deal sizes</th>
                <th className="almedia-numeric" scope="col">
                  Committed
                </th>
                <th className="almedia-numeric" scope="col">
                  Dropout
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const committed =
                  row.counts.booked + row.counts.published + row.counts.longterm;
                const badge = paceBadge(row.pace);

                return (
                  <tr key={`${row.cm ?? ""}-${row.market ?? ""}-${row.month}`}>
                    <td>{row.cm ?? "—"}</td>
                    <td>{row.market ?? "—"}</td>
                    <td>{monthLabel(row.month)}</td>
                    <td className="almedia-numeric almedia-numeric--emphasis">
                      {formatEurCompact(row.bookedEur)}
                    </td>
                    <td className="almedia-numeric">
                      {formatEurCompact(row.targetEur)}
                    </td>
                    <td>
                      <div className="almedia-progress-cell">
                        <ProgressBar utilization={row.utilization} />
                        <span>
                          {row.targetEur === null
                            ? "no plan"
                            : formatShare(row.utilization)}
                        </span>
                        {badge ? (
                          <span
                            className={`almedia-pace almedia-pace--${badge.modifier}`}
                          >
                            {badge.label}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <TierChips row={row} />
                    </td>
                    <td className="almedia-numeric">
                      {committed}
                      {row.counts.pipeline > 0 ? (
                        <span className="almedia-subnote">
                          +{row.counts.pipeline} pipeline
                        </span>
                      ) : null}
                    </td>
                    <td className="almedia-numeric">{formatShare(row.dropoutRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
