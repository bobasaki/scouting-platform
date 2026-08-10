import React from "react";

import type { MonthlyPerformance } from "../../lib/almedia/campaign-analytics";

/**
 * Monthly cost bars with a cost-weighted lifetime-ROAS line. Hand-rolled inline
 * SVG (as in the source dashboard) — no charting dependency.
 */

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const wholeNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const decimalNumber = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const WIDTH = 900;
const HEIGHT = 310;
const MARGIN = { top: 24, right: 50, bottom: 50, left: 58 } as const;
const GRIDLINE_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

export function AlmediaPerformanceChart({
  data,
}: Readonly<{ data: readonly MonthlyPerformance[] }>) {
  if (data.length === 0) {
    return (
      <p className="almedia-chart-empty">No dated campaigns match these filters.</p>
    );
  }

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxCost = Math.max(...data.map((item) => item.cost), 1);
  const maxRoas = Math.max(...data.map((item) => item.roas ?? 0), 1);
  const step = plotWidth / data.length;
  const barWidth = Math.max(8, Math.min(34, step * 0.52));
  const x = (index: number): number => MARGIN.left + step * index + step / 2;
  const costY = (value: number): number =>
    MARGIN.top + plotHeight - (value / maxCost) * plotHeight;
  const roasY = (value: number): number =>
    MARGIN.top + plotHeight - (value / maxRoas) * plotHeight;
  const points = data
    .map((item, index) => (item.roas === null ? null : `${x(index)},${roasY(item.roas)}`))
    .filter((point): point is string => point !== null)
    .join(" ");
  const tickEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg
      aria-labelledby="almedia-performance-chart-title almedia-performance-chart-desc"
      className="almedia-chart"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <title id="almedia-performance-chart-title">
        Monthly cost and lifetime ROAS
      </title>
      <desc id="almedia-performance-chart-desc">
        Bars show total campaign cost per month and the line shows cost-weighted
        lifetime ROAS.
      </desc>

      {GRIDLINE_FRACTIONS.map((fraction) => {
        const y = MARGIN.top + plotHeight * (1 - fraction);

        return (
          <g key={fraction}>
            <line
              className="almedia-chart__gridline"
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y}
              y2={y}
            />
            <text
              className="almedia-chart__axis"
              textAnchor="end"
              x={MARGIN.left - 10}
              y={y + 4}
            >
              {compactNumber.format(maxCost * fraction)}
            </text>
            <text
              className="almedia-chart__axis"
              textAnchor="start"
              x={WIDTH - MARGIN.right + 10}
              y={y + 4}
            >
              {(maxRoas * fraction).toFixed(1)}×
            </text>
          </g>
        );
      })}

      {data.map((item, index) => {
        const top = costY(item.cost);

        return (
          <g key={item.key}>
            <rect
              className="almedia-chart__bar"
              height={MARGIN.top + plotHeight - top}
              rx={4}
              width={barWidth}
              x={x(index) - barWidth / 2}
              y={top}
            >
              <title>{`${item.label}: ${wholeNumber.format(item.cost)} cost across ${item.campaigns} campaigns`}</title>
            </rect>
            {index % tickEvery === 0 || index === data.length - 1 ? (
              <text
                className="almedia-chart__axis"
                textAnchor="middle"
                x={x(index)}
                y={HEIGHT - 20}
              >
                {item.label}
              </text>
            ) : null}
          </g>
        );
      })}

      {points ? (
        <polyline className="almedia-chart__line" fill="none" points={points} />
      ) : null}

      {data.map((item, index) =>
        item.roas === null ? null : (
          <circle
            className="almedia-chart__point"
            cx={x(index)}
            cy={roasY(item.roas)}
            key={item.key}
            r={4}
          >
            <title>{`${item.label}: ${decimalNumber.format(item.roas)}× lifetime ROAS`}</title>
          </circle>
        ),
      )}
    </svg>
  );
}
