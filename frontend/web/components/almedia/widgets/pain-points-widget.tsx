"use client";

import type { AlmediaDeal, AlmediaDimensionId } from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { painPoints } from "../../../lib/almedia/filters";

/** Pain points by market / vertical / client size, rule-derived from the data. */

const TABS: ReadonlyArray<{ id: AlmediaDimensionId | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "country", label: "By market" },
  { id: "vertical", label: "By vertical" },
  { id: "sizeTier", label: "By size" },
];

type PainTab = (typeof TABS)[number]["id"];

export function PainPointsWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const [tab, setTab] = useState<PainTab>("all");
  const points = useMemo(() => painPoints(deals), [deals]);
  const visible =
    tab === "all" ? points : points.filter((point) => point.dimension === tab);

  return (
    <>
      <div
        aria-label="Pain point dimension"
        className="almedia-segmented"
        role="tablist"
      >
        {TABS.map(({ id, label }) => (
          <button
            aria-selected={tab === id}
            key={id}
            onClick={() => {
              setTab(id);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="almedia-widget__empty">
          No pain points detected here. Either healthy, or not enough measured deals
          yet.
        </p>
      ) : (
        <ul className="almedia-pain-list">
          {visible.map((point) => (
            <li key={`${point.dimension}-${point.key}-${point.issue}`}>
              <span className={`almedia-pain-badge almedia-pain-badge--${point.severity}`}>
                {point.severity === "high" ? "High" : "Medium"}
              </span>
              <p>{point.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
