"use client";

import {
  ALMEDIA_DIMENSIONS,
  type AlmediaDeal,
  type AlmediaDimensionId,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { groupByDimension } from "../../../lib/almedia/filters";
import { formatAmount, formatPct } from "../../../lib/almedia/format";
import { platformLabel } from "../../../lib/almedia/labels";
import { BarList, returnTone, type BarRow } from "./bar-list";

/**
 * Returns by parameter — cost-weighted average return % grouped by any
 * dimension, coloured by the rebooking tiers so CLs/CMs can see at a glance
 * where outreach and booking should shift next month.
 */

const GROUPABLE = ALMEDIA_DIMENSIONS.filter(({ id }) => id !== "status");

export function ReturnsWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const [dimension, setDimension] = useState<AlmediaDimensionId>("country");

  const rows = useMemo<BarRow[]>(
    () =>
      groupByDimension(deals, dimension)
        .filter((group) => group.avgReturnPct !== null)
        .sort((a, b) => (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0))
        .map((group) => ({
          key: dimension === "platform" ? platformLabel(group.key) : group.key,
          value: group.avgReturnPct,
          display: formatPct(group.avgReturnPct),
          meta: `${group.measured} measured · ${formatAmount(group.cost)}`,
          tone: returnTone(group.avgReturnPct),
        })),
    [deals, dimension],
  );

  return (
    <>
      <label className="almedia-field almedia-field--inline">
        <span>Group by</span>
        <select
          onChange={(event) => {
            setDimension(event.target.value as AlmediaDimensionId);
          }}
          value={dimension}
        >
          {GROUPABLE.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <BarList
        empty="No measured returns yet for the current filters."
        max={Math.max(120, ...rows.map((row) => row.value ?? 0))}
        rows={rows}
      />
      <p className="almedia-widget__footnote">
        Cost-weighted return · &gt;100% longterm · 80–100% rebook · 50–80% adjust price ·
        &lt;50% drop
      </p>
    </>
  );
}
