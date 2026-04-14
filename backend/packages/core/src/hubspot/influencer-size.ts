const INFLUENCER_SIZE_TIERS = [
  { min: 1_000_000, label: "Macro-tier (1M+)" },
  { min: 500_000, label: "Mega (500K - 1M)" },
  { min: 100_000, label: "Macro (100K - 500K)" },
  { min: 20_000, label: "Mid-tier (20K - 100K)" },
  { min: 5_000, label: "Micro (5K - 20K)" },
  { min: 1_000, label: "Nano (1K - 5K)" },
] as const;

export type InfluencerSizeTier = (typeof INFLUENCER_SIZE_TIERS)[number]["label"];

export function computeInfluencerSizeTier(
  subscriberCount: bigint | number | null | undefined,
): string {
  if (subscriberCount === null || subscriberCount === undefined) {
    return "";
  }

  const count = Number(subscriberCount);

  if (!Number.isFinite(count) || count < 0) {
    return "";
  }

  for (const tier of INFLUENCER_SIZE_TIERS) {
    if (count >= tier.min) {
      return tier.label;
    }
  }

  return "";
}
