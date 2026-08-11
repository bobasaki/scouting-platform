"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { efficiencyPoints } from "../../../lib/almedia/charts";
import { formatCount, formatAmount, formatPct } from "../../../lib/almedia/format";

/**
 * Efficiency scatter — spend (X) against return % (Y), bubble size by views.
 * The efficient frontier at a glance: points above the 100% line are longterm
 * candidates, and big cheap bubbles high up are the deals to clone.
 */

const WIDTH = 440;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 34, left: 44 } as const;
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
/** Cap so one runaway return cannot flatten the rest of the field. */
const RETURN_AXIS_CAP = 300;

export function EfficiencyWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const points = useMemo(() => efficiencyPoints(deals), [deals]);

  const scales = useMemo(() => {
    const maxCost = Math.max(1, ...points.map((point) => point.cost));
    const dataMax = Math.max(160, ...points.map((point) => point.returnPct));
    const maxReturn = Math.min(dataMax, RETURN_AXIS_CAP);
    const maxViews = Math.max(1, ...points.map((point) => point.views ?? 0));

    return {
      maxCost,
      maxReturn,
      clipped: dataMax > maxReturn,
      x: (cost: number): number => PAD.left + (cost / maxCost) * PLOT_W,
      y: (returnPct: number): number =>
        PAD.top + PLOT_H - (Math.min(returnPct, maxReturn) / maxReturn) * PLOT_H,
      r: (views: number | null): number => 4 + Math.sqrt((views ?? 0) / maxViews) * 9,
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="almedia-widget__empty">
        No measured, priced deals for the current filters.
      </p>
    );
  }

  const yTicks = [0, 100, 200, scales.maxReturn].filter(
    (tick, index, all) => all.indexOf(tick) === index && tick <= scales.maxReturn,
  );

  return (
    <>
      <svg
        aria-label="Spend versus return scatter"
        className="almedia-scatter"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="almedia-scatter__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={scales.y(tick)}
              y2={scales.y(tick)}
            />
            <text
              className="almedia-scatter__axis"
              textAnchor="end"
              x={PAD.left - 6}
              y={scales.y(tick) + 3}
            >
              {Math.round(tick)}%
            </text>
          </g>
        ))}

        <line
          className="almedia-scatter__ref"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={scales.y(100)}
          y2={scales.y(100)}
        />

        {points.map((point, index) => (
          <circle
            className={`almedia-scatter__dot almedia-tone--${point.tone}`}
            cx={scales.x(point.cost)}
            cy={scales.y(point.returnPct)}
            key={`${point.channelName}-${String(index)}`}
            r={scales.r(point.views)}
          >
            {/* SVG <title> takes a single text node, so build one string. */}
            <title>
              {`${point.channelName}: ${formatPct(point.returnPct)} return · ${formatAmount(point.cost)} · ${formatCount(point.views)} views`}
            </title>
          </circle>
        ))}

        <text
          className="almedia-scatter__axis"
          textAnchor="start"
          x={PAD.left}
          y={HEIGHT - 8}
        >
          {formatAmount(0)}
        </text>
        <text
          className="almedia-scatter__axis"
          textAnchor="end"
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
        >
          {formatAmount(scales.maxCost)}
        </text>
      </svg>

      <p className="almedia-widget__footnote">
        {points.length} deals · X spend · Y return · bubble = views · dashed line = 100%
        (longterm threshold)
        {scales.clipped
          ? ` · returns above ${String(scales.maxReturn)}% pinned to the top`
          : ""}
      </p>
    </>
  );
}
