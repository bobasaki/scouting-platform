/** Display formatters shared by the Almedia tabs and widgets. */

import { ALMEDIA_CURRENCY } from "@scouting-platform/contracts";

/**
 * Re-exported so a view can name the currency it is rendering without reaching
 * past this module. There is only ever one, defined in contracts.
 */
export { ALMEDIA_CURRENCY };

/** Whole units, e.g. "$1,234". */
export function formatAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: ALMEDIA_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact, for dense cards, e.g. "$42.0K". */
export function formatAmountCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: ALMEDIA_CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Precise, with cents — for small per-user values like APPU. */
export function formatAmountPrecise(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: ALMEDIA_CURRENCY,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return Math.round(value).toLocaleString("en");
}

export function formatPct(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return `${value.toFixed(digits)}%`;
}

/** A 0..1 ratio rendered as a whole percentage. */
export function formatShare(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

export function timeAgo(date: Date | null, now: Date = new Date()): string {
  if (!date) {
    return "–";
  }

  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));

  if (minutes === 0) {
    return "just now";
  }

  if (minutes === 1) {
    return "1 min ago";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
