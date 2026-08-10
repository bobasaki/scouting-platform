"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { roundAnalysis } from "../../../lib/almedia/charts";
import { formatEur, formatPct, formatShare } from "../../../lib/almedia/format";
import { BarList, returnTone, type BarRow } from "./bar-list";

/**
 * Rebooking & round-over-round lift — does return improve as we re-engage a
 * creator? Rebook rate is the agency-compounding metric; the bars show
 * cost-weighted return per booking round (parsed from the campaign name).
 */
export function RebookingWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const { rounds, rebookedChannels, totalChannels, rebookRate } = useMemo(
    () => roundAnalysis(deals),
    [deals],
  );

  if (totalChannels === 0) {
    return (
      <p className="almedia-widget__empty">
        No live campaigns for the current filters.
      </p>
    );
  }

  const rows: BarRow[] = rounds.map((group) => ({
    key: group.label,
    value: group.avgReturnPct,
    display: formatPct(group.avgReturnPct),
    meta: `${group.channels} channel${group.channels === 1 ? "" : "s"} · ${formatEur(group.cost)}`,
    tone: returnTone(group.avgReturnPct),
  }));

  return (
    <>
      <p className="almedia-widget__lead">
        Rebook rate <strong>{formatShare(rebookRate)}</strong> · {rebookedChannels} of{" "}
        {totalChannels} channels booked more than once
      </p>
      <BarList
        empty="No rounds to compare yet."
        max={Math.max(120, ...rows.map((row) => row.value ?? 0))}
        rows={rows}
      />
      <p className="almedia-widget__footnote">
        Cost-weighted return per booking round · rising bars mean re-engaged creators
        pay off
      </p>
    </>
  );
}
