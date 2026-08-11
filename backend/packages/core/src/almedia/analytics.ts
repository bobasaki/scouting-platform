import type {
  AlmediaMaturity,
  AlmediaReturnTier,
  AlmediaSizeTier,
} from "@scouting-platform/contracts";

/**
 * Return-tier, maturity, and deal-size classification. Pure functions, ported
 * from the standalone tracker's `dashboard/src/analytics.ts`. These are the
 * business rules behind every "what should we do with this deal" decision, so
 * they live in core and are stamped onto each deal server-side.
 */

export const ALMEDIA_RETURN_TIERS = [
  { id: "longterm", label: "Longterm", range: "> 100%" },
  { id: "rebooking", label: "Rebooking", range: "80–100%" },
  { id: "price_adjusted", label: "Rebooking · price adjusted", range: "50–<80%" },
  { id: "drop", label: "Drop", range: "< 50%" },
] as const satisfies ReadonlyArray<{
  id: AlmediaReturnTier;
  label: string;
  range: string;
}>;

/** A campaign's downstream metrics are considered final after this long. */
const MATURITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getMaturityInfo(
  publishedAt: string | null,
  now: Date = new Date(),
): AlmediaMaturity {
  if (!publishedAt) {
    return { status: "unknown", daysRemaining: null };
  }

  const publishedTime = Date.parse(publishedAt);

  if (Number.isNaN(publishedTime)) {
    return { status: "unknown", daysRemaining: null };
  }

  const matureAt = publishedTime + MATURITY_DAYS * DAY_MS;

  if (now.getTime() >= matureAt) {
    return { status: "matured", daysRemaining: 0 };
  }

  return {
    status: "maturing",
    daysRemaining: Math.max(1, Math.ceil((matureAt - now.getTime()) / DAY_MS)),
  };
}

export function getReturnTier(value: number | null): AlmediaReturnTier | null {
  if (value === null) {
    return null;
  }

  if (value > 100) {
    return "longterm";
  }

  if (value >= 80) {
    return "rebooking";
  }

  if (value >= 50) {
    return "price_adjusted";
  }

  return "drop";
}

/** Deal-size tier from the internal budget, falling back to campaign cost. */
export function getSizeTier(amount: number | null): AlmediaSizeTier | null {
  if (amount === null || !Number.isFinite(amount)) {
    return null;
  }

  if (amount < 10_000) {
    return "<10k";
  }

  if (amount < 20_000) {
    return "10-20k";
  }

  if (amount <= 50_000) {
    return "20-50k";
  }

  return ">50k";
}
