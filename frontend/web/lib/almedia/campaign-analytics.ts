import type {
  AlmediaCampaignRow,
  AlmediaMaturity,
  AlmediaReturnTier,
} from "@scouting-platform/contracts";

import { monthLabel } from "./labels";

/**
 * Campaign-level analytics behind the Performance tab, which works on the raw
 * Almedia feed rather than the joined deal rows. Ported from the standalone
 * tracker's `dashboard/src/analytics.ts`.
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

const MATURITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CampaignFilters {
  platform: string;
  country: string;
  returnTier: string;
  maturity: string;
  from: string;
  to: string;
  search: string;
}

export const EMPTY_CAMPAIGN_FILTERS: CampaignFilters = {
  platform: "all",
  country: "all",
  returnTier: "all",
  maturity: "all",
  from: "",
  to: "",
  search: "",
};

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
  if (value === null) return null;
  if (value > 100) return "longterm";
  if (value >= 80) return "rebooking";
  if (value >= 50) return "price_adjusted";
  return "drop";
}

type NumericCampaignField = {
  [K in keyof AlmediaCampaignRow]: AlmediaCampaignRow[K] extends number | null
    ? K
    : never;
}[keyof AlmediaCampaignRow];

export function sumCampaigns(
  campaigns: readonly AlmediaCampaignRow[],
  field: NumericCampaignField,
): number {
  return campaigns.reduce((total, campaign) => total + (campaign[field] ?? 0), 0);
}

export function weightedAverage(
  campaigns: readonly AlmediaCampaignRow[],
  valueField: NumericCampaignField,
  weightField: NumericCampaignField,
): number | null {
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const campaign of campaigns) {
    const value = campaign[valueField];
    const weight = campaign[weightField];

    if (value !== null && weight !== null && weight > 0) {
      weightedTotal += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedTotal / totalWeight : null;
}

export function filterCampaigns(
  campaigns: readonly AlmediaCampaignRow[],
  filters: CampaignFilters,
  now: Date = new Date(),
): AlmediaCampaignRow[] {
  const query = filters.search.trim().toLocaleLowerCase();

  return campaigns.filter((campaign) => {
    const date = campaign.publishedAt?.slice(0, 10) ?? "";

    return (
      (filters.platform === "all" || campaign.platform === filters.platform) &&
      (!filters.country ||
        filters.country === "all" ||
        campaign.country === filters.country) &&
      (!filters.returnTier ||
        filters.returnTier === "all" ||
        getReturnTier(campaign.returnPct) === filters.returnTier) &&
      (!filters.maturity ||
        filters.maturity === "all" ||
        getMaturityInfo(campaign.publishedAt, now).status === filters.maturity) &&
      (!filters.from || (date !== "" && date >= filters.from)) &&
      (!filters.to || (date !== "" && date <= filters.to)) &&
      (!query ||
        campaign.campaignName.toLocaleLowerCase().includes(query) ||
        (campaign.channelName?.toLocaleLowerCase().includes(query) ?? false))
    );
  });
}

export interface ReturnTierGroup {
  id: AlmediaReturnTier;
  label: string;
  range: string;
  count: number;
  share: number;
  averageReturn: number | null;
}

export function returnTierGroups(
  campaigns: readonly AlmediaCampaignRow[],
): ReturnTierGroup[] {
  const classifiedCount = campaigns.filter(
    (campaign) => getReturnTier(campaign.returnPct) !== null,
  ).length;

  return ALMEDIA_RETURN_TIERS.map((tier) => {
    const rows = campaigns.filter(
      (campaign) => getReturnTier(campaign.returnPct) === tier.id,
    );
    const returns = rows
      .map((campaign) => campaign.returnPct)
      .filter((value): value is number => value !== null);

    return {
      ...tier,
      count: rows.length,
      share: classifiedCount > 0 ? rows.length / classifiedCount : 0,
      averageReturn:
        returns.length > 0
          ? returns.reduce((total, value) => total + value, 0) / returns.length
          : null,
    };
  });
}

export interface MonthlyPerformance {
  key: string;
  label: string;
  cost: number;
  roas: number | null;
  campaigns: number;
}

export function monthlyPerformance(
  campaigns: readonly AlmediaCampaignRow[],
): MonthlyPerformance[] {
  const groups = new Map<string, AlmediaCampaignRow[]>();

  for (const campaign of campaigns) {
    if (!campaign.publishedAt) {
      continue;
    }

    const key = campaign.publishedAt.slice(0, 7);

    groups.set(key, [...(groups.get(key) ?? []), campaign]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({
      key,
      label: monthLabel(key),
      cost: sumCampaigns(rows, "cost"),
      roas: weightedAverage(rows, "roasReturn", "cost"),
      campaigns: rows.length,
    }));
}

export interface PlatformGroup {
  platform: string;
  campaigns: number;
  cost: number;
  views: number;
  roas: number | null;
}

export function platformGroups(
  campaigns: readonly AlmediaCampaignRow[],
): PlatformGroup[] {
  const platforms = [...new Set(campaigns.map((campaign) => campaign.platform))].sort();

  return platforms.map((platform) => {
    const rows = campaigns.filter((campaign) => campaign.platform === platform);

    return {
      platform,
      campaigns: rows.length,
      cost: sumCampaigns(rows, "cost"),
      views: sumCampaigns(rows, "viewCount"),
      roas: weightedAverage(rows, "roasReturn", "cost"),
    };
  });
}
