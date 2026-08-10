import React, { type ReactNode } from "react";

/** Horizontal bar rows used by the returns / budget / concentration widgets. */

export type BarTone = "good" | "warn" | "bad" | "neutral";

export interface BarRow {
  key: string;
  value: number | null;
  display: string;
  meta?: string;
  tone?: BarTone;
}

type BarListProps = Readonly<{
  rows: readonly BarRow[];
  /** Scale bars against this max; defaults to the largest row value. */
  max?: number;
  empty?: ReactNode;
}>;

export function BarList({ rows, max, empty }: BarListProps) {
  if (rows.length === 0) {
    return (
      <p className="almedia-widget__empty">
        {empty ?? "No data for the current filters."}
      </p>
    );
  }

  const scale = max ?? Math.max(...rows.map((row) => row.value ?? 0), 1);

  return (
    <ul className="almedia-bar-list">
      {rows.map((row) => (
        <li className="almedia-bar" key={row.key}>
          <p className="almedia-bar__heading">
            <span className="almedia-bar__label">{row.key}</span>
            <span className="almedia-bar__value">
              {row.display}
              {row.meta ? <em>{row.meta}</em> : null}
            </span>
          </p>
          <div aria-hidden="true" className="almedia-bar__track">
            <i
              className={`almedia-bar__fill almedia-tone--${row.tone ?? "neutral"}`}
              style={{
                width: `${Math.min(100, Math.max(2, ((row.value ?? 0) / scale) * 100))}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function returnTone(returnPct: number | null): BarTone {
  if (returnPct === null) return "neutral";
  if (returnPct > 100) return "good";
  if (returnPct >= 80) return "neutral";
  if (returnPct >= 50) return "warn";
  return "bad";
}
