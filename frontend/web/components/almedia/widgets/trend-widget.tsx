"use client";

import type { AlmediaDeal } from "@scouting-platform/contracts";
import React, { useMemo } from "react";

import { monthlyTrend } from "../../../lib/almedia/charts";
import { formatAmount, formatPct } from "../../../lib/almedia/format";
import { returnTone } from "./bar-list";

/**
 * Monthly return trend — cost-weighted return as a line over the 100% longterm
 * threshold, with spend as faint columns behind for context. The executive
 * "are we trending up or down" read across publish months.
 */

const WIDTH = 440;
const HEIGHT = 250;
const PAD = { top: 16, right: 14, bottom: 30, left: 40 } as const;
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const RETURN_AXIS_CAP = 300;

export function TrendWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  const points = useMemo(() => monthlyTrend(deals), [deals]);

  const geometry = useMemo(() => {
    const measured = points.filter((point) => point.avgReturnPct !== null);
    const dataMax = Math.max(160, ...measured.map((point) => point.avgReturnPct ?? 0));
    const maxReturn = Math.min(dataMax, RETURN_AXIS_CAP);
    const maxCost = Math.max(1, ...points.map((point) => point.cost));
    const step = points.length > 1 ? PLOT_W / (points.length - 1) : 0;

    return {
      maxReturn,
      maxCost,
      x: (index: number): number =>
        points.length > 1 ? PAD.left + index * step : PAD.left + PLOT_W / 2,
      y: (returnPct: number): number =>
        PAD.top + PLOT_H - (Math.min(returnPct, maxReturn) / maxReturn) * PLOT_H,
      barWidth: Math.min(34, points.length > 1 ? step * 0.5 : 60),
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="almedia-widget__empty">
        No live campaigns with a publish date for these filters.
      </p>
    );
  }

  const linePath = points
    .map((point, index) =>
      point.avgReturnPct === null
        ? null
        : { x: geometry.x(index), y: geometry.y(point.avgReturnPct) },
    )
    .filter((node): node is { x: number; y: number } => node !== null)
    .map((node, index) => `${index === 0 ? "M" : "L"}${String(node.x)},${String(node.y)}`)
    .join(" ");

  // Full-year labels ("Jul 2026") are wide, so thin them when months crowd.
  const labelStride = Math.max(1, Math.ceil(points.length / 7));

  return (
    <>
      <svg
        aria-label="Monthly return trend"
        className="almedia-scatter"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {[0, 100, geometry.maxReturn].map((tick) => (
          <g key={tick}>
            <line
              className="almedia-scatter__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={geometry.y(tick)}
              y2={geometry.y(tick)}
            />
            <text
              className="almedia-scatter__axis"
              textAnchor="end"
              x={PAD.left - 6}
              y={geometry.y(tick) + 3}
            >
              {Math.round(tick)}%
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const height = (point.cost / geometry.maxCost) * PLOT_H;

          return (
            <rect
              className="almedia-trend__bar"
              height={Math.max(0, height)}
              key={`bar-${point.month}`}
              width={geometry.barWidth}
              x={geometry.x(index) - geometry.barWidth / 2}
              y={PAD.top + PLOT_H - height}
            >
              {/* SVG <title> takes a single text node, so build one string. */}
              <title>
                {`${point.label}: ${formatAmount(point.cost)} spend · ${String(point.deals)} deals`}
              </title>
            </rect>
          );
        })}

        <line
          className="almedia-scatter__ref"
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={geometry.y(100)}
          y2={geometry.y(100)}
        />

        {linePath ? (
          <path className="almedia-trend__line" d={linePath} fill="none" />
        ) : null}

        {points.map((point, index) =>
          point.avgReturnPct === null ? null : (
            <circle
              className={`almedia-scatter__dot almedia-tone--${returnTone(point.avgReturnPct)}`}
              cx={geometry.x(index)}
              cy={geometry.y(point.avgReturnPct)}
              key={`dot-${point.month}`}
              r={4.5}
            >
              <title>
                {`${point.label}: ${formatPct(point.avgReturnPct)} return · ${formatAmount(point.cost)}`}
              </title>
            </circle>
          ),
        )}

        {points.map((point, index) =>
          index % labelStride === 0 || index === points.length - 1 ? (
            <text
              className="almedia-scatter__axis"
              key={`label-${point.month}`}
              textAnchor="middle"
              x={geometry.x(index)}
              y={HEIGHT - 8}
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>

      <p className="almedia-widget__footnote">
        Cost-weighted return per publish month · dashed line = 100% · columns = spend
        {geometry.maxReturn === RETURN_AXIS_CAP
          ? ` · return axis capped at ${String(RETURN_AXIS_CAP)}%`
          : ""}
      </p>
    </>
  );
}
