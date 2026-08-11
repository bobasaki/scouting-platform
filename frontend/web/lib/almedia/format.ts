/** Display formatters shared by the Almedia tabs and widgets. */

export function formatEur(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * USD whole-dollar amounts. The Almedia `cost` field and the whole invoicing
 * model are dollar-denominated, unlike the EUR booking budgets, so the billing
 * views must not borrow the EUR formatter.
 */
export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Compact EUR for dense cards, e.g. "€42K". */
export function formatEurCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Precise EUR with cents — for small per-user values like APPU. */
export function formatMoney(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) {
    return "–";
  }

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
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
