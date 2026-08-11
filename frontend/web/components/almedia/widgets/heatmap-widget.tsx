"use client";

import {
  ALMEDIA_DIMENSIONS,
  type AlmediaDeal,
  type AlmediaDimensionId,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { crossTab, type HeatCell } from "../../../lib/almedia/charts";
import { formatAmount, formatPct } from "../../../lib/almedia/format";
import { platformLabel } from "../../../lib/almedia/labels";

/**
 * Segment heatmap — cost-weighted return across two dimensions (default
 * market × vertical). The most direct "where should we push next month" read:
 * green cells with real spend behind them are where to lean in.
 */

const AXES = ALMEDIA_DIMENSIONS.filter(
  ({ id }) => id !== "status" && id !== "month",
);
const MAX_AXIS_ENTRIES = 8;

function toneOf(cell: HeatCell): string {
  if (cell.avgReturnPct === null) return "empty";
  if (cell.avgReturnPct > 100) return "good";
  if (cell.avgReturnPct >= 80) return "neutral";
  if (cell.avgReturnPct >= 50) return "warn";
  return "bad";
}

function isDimensionId(value: string): value is AlmediaDimensionId {
  return AXES.some((axis) => axis.id === value);
}

export function HeatmapWidget({ deals }: Readonly<{ deals: readonly AlmediaDeal[] }>) {
  // Country comes straight from Almedia, so the intended market × vertical
  // steering view stays populated even for campaigns without a booking row.
  const [rowDim, setRowDim] = useState<AlmediaDimensionId>("country");
  const [colDim, setColDim] = useState<AlmediaDimensionId>("vertical");

  const table = useMemo(() => crossTab(deals, rowDim, colDim), [deals, rowDim, colDim]);
  const byKey = useMemo(() => {
    const map = new Map<string, HeatCell>();

    for (const cell of table.cells) {
      map.set(`${cell.row}|${cell.col}`, cell);
    }

    return map;
  }, [table]);

  const rows = table.rows.slice(0, MAX_AXIS_ENTRIES);
  const cols = table.cols.slice(0, MAX_AXIS_ENTRIES);

  const rowText = (value: string): string =>
    rowDim === "platform" ? platformLabel(value) : value;
  const colText = (value: string): string =>
    colDim === "platform" ? platformLabel(value) : value;

  return (
    <>
      <div className="almedia-widget__controls">
        <label className="almedia-widget__control">
          <span>Rows</span>
          <select
            onChange={(event) => {
              if (isDimensionId(event.target.value)) {
                setRowDim(event.target.value);
              }
            }}
            value={rowDim}
          >
            {AXES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="almedia-widget__control">
          <span>Columns</span>
          <select
            onChange={(event) => {
              if (isDimensionId(event.target.value)) {
                setColDim(event.target.value);
              }
            }}
            value={colDim}
          >
            {AXES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 || cols.length === 0 ? (
        <p className="almedia-widget__empty">
          Not enough data to cross these dimensions.
        </p>
      ) : (
        <div className="almedia-heatmap__scroll">
          <table className="almedia-heatmap">
            <thead>
              <tr>
                <th aria-hidden="true" />
                {cols.map((col) => (
                  <th key={col} scope="col">
                    {colText(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <th scope="row">{rowText(row)}</th>
                  {cols.map((col) => {
                    const cell = byKey.get(`${row}|${col}`);

                    if (!cell) {
                      return (
                        <td
                          className="almedia-heatmap__cell almedia-tone--empty"
                          key={col}
                        />
                      );
                    }

                    return (
                      <td
                        className={`almedia-heatmap__cell almedia-tone--${toneOf(cell)}`}
                        key={col}
                        title={`${rowText(row)} · ${colText(col)}\n${formatPct(cell.avgReturnPct)} return · ${formatAmount(cell.cost)} · ${String(cell.deals)} deals`}
                      >
                        <span className="almedia-heatmap__value">
                          {formatPct(cell.avgReturnPct)}
                        </span>
                        <span className="almedia-heatmap__meta">
                          {formatAmount(cell.cost)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="almedia-widget__footnote">
        Cost-weighted return per cell · green &gt;100% · hover for deal count · top{" "}
        {MAX_AXIS_ENTRIES} × {MAX_AXIS_ENTRIES} by spend
      </p>
    </>
  );
}
