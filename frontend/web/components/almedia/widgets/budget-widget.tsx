"use client";

import type { AlmediaDeal, AlmediaDimensionId } from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { groupByDimension } from "../../../lib/almedia/filters";
import { formatAmount } from "../../../lib/almedia/format";
import { BarList, type BarRow } from "./bar-list";

/**
 * Budget per CM / country / category — committed internal budget with live
 * Almedia spend alongside, switchable between the three dimensions.
 */

const BUDGET_DIMENSIONS: ReadonlyArray<{ id: AlmediaDimensionId; label: string }> = [
  { id: "cm", label: "Per CM" },
  { id: "country", label: "Per country" },
  { id: "category", label: "Per category" },
];

export function BudgetWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const [dimension, setDimension] = useState<AlmediaDimensionId>("cm");

  const rows = useMemo<BarRow[]>(
    () =>
      groupByDimension(deals, dimension)
        .filter((group) => group.intBudget > 0 || group.cost > 0)
        .map((group) => ({
          key: group.key,
          value: Math.max(group.intBudget, group.cost),
          display: formatAmount(group.intBudget > 0 ? group.intBudget : group.cost),
          meta:
            group.intBudget > 0 && group.cost > 0
              ? `${formatAmount(group.cost)} spent live`
              : group.intBudget > 0
                ? "booked"
                : "live spend only",
          tone: "neutral" as const,
        })),
    [deals, dimension],
  );

  return (
    <>
      <div
        aria-label="Budget dimension"
        className="almedia-segmented"
        role="tablist"
      >
        {BUDGET_DIMENSIONS.map(({ id, label }) => (
          <button
            aria-selected={dimension === id}
            key={id}
            onClick={() => {
              setDimension(id);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <BarList empty="No budgets recorded for the current filters." rows={rows} />
      <p className="almedia-widget__footnote">
        INT budget from the tracker · live spend from Almedia
      </p>
    </>
  );
}
