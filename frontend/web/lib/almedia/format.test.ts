import type { AlmediaCampaignRow } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { buildCampaignsCsv } from "./csv-export";
import {
  ALMEDIA_CURRENCY,
  formatAmount,
  formatAmountCompact,
  formatAmountPrecise,
  formatCount,
  formatPct,
  formatShare,
  timeAgo,
} from "./format";
import { bookingStatusLabel, monthLabel, platformLabel } from "./labels";

describe("formatters", () => {
  it("renders whole amounts and a dash for missing values", () => {
    expect(formatAmount(1234)).toBe("$1,234");
    expect(formatAmount(null)).toBe("–");
    expect(formatAmount(Number.NaN)).toBe("–");
  });

  it("renders precise money for small per-user values", () => {
    expect(formatAmountPrecise(3.456)).toBe("$3.46");
  });

  it("compacts large amounts", () => {
    expect(formatAmountCompact(42_000)).toBe("$42.0K");
    expect(formatAmountCompact(1_477_974)).toBe("$1.5M");
  });

  // The whole point of the constant is that no view can pick its own currency.
  it("drives every money formatter from one currency", () => {
    expect(ALMEDIA_CURRENCY).toBe("USD");

    for (const rendered of [
      formatAmount(1000),
      formatAmountCompact(1000),
      formatAmountPrecise(1000),
    ]) {
      expect(rendered.startsWith("$")).toBe(true);
      expect(rendered).not.toContain("€");
    }
  });

  it("abbreviates large counts", () => {
    expect(formatCount(950)).toBe("950");
    expect(formatCount(1_500)).toBe("1.5k");
    expect(formatCount(84_000)).toBe("84k");
    expect(formatCount(2_400_000)).toBe("2.4M");
    expect(formatCount(null)).toBe("–");
  });

  it("renders percentages and 0..1 shares", () => {
    expect(formatPct(87.4)).toBe("87%");
    expect(formatPct(87.44, 1)).toBe("87.4%");
    expect(formatShare(0.256)).toBe("26%");
    expect(formatShare(null)).toBe("–");
  });

  it("describes relative time in minutes and hours", () => {
    const now = new Date("2026-08-10T12:00:00Z");

    expect(timeAgo(new Date("2026-08-10T12:00:00Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-08-10T11:59:00Z"), now)).toBe("1 min ago");
    expect(timeAgo(new Date("2026-08-10T11:30:00Z"), now)).toBe("30 min ago");
    expect(timeAgo(new Date("2026-08-10T11:00:00Z"), now)).toBe("1 hour ago");
    expect(timeAgo(new Date("2026-08-10T09:00:00Z"), now)).toBe("3 hours ago");
    expect(timeAgo(null, now)).toBe("–");
  });
});

describe("labels", () => {
  it("uses each platform's own capitalisation", () => {
    expect(platformLabel("youtube")).toBe("YouTube");
    expect(platformLabel("TIKTOK")).toBe("TikTok");
    expect(platformLabel("mastodon")).toBe("Mastodon");
    expect(platformLabel(null)).toBe("—");
  });

  it("renders months with a full year", () => {
    expect(monthLabel("2026-07")).toBe("Jul 2026");
    expect(monthLabel("not-a-month")).toBe("not-a-month");
  });

  it("labels booking statuses", () => {
    expect(bookingStatusLabel("longterm")).toBe("Longterm");
    expect(bookingStatusLabel(null)).toBe("—");
  });
});

describe("buildCampaignsCsv", () => {
  const campaign: AlmediaCampaignRow = {
    campaignName: "ASMRFIXY_YT_R1",
    campaignSource: "ARCH.",
    platform: "youtube",
    country: "PL",
    publishedAt: "2026-07-13T18:00:20.000Z",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 40_000,
    signupsPct: null,
    roasD7pD14: null,
    roasReturn: null,
    returnPct: 90,
    appuD14: null,
    d7Purchases: null,
    channelName: "ASMR Fixy",
    videoUrl: null,
  };

  it("writes a header row followed by one row per campaign", () => {
    const lines = buildCampaignsCsv([campaign]).split("\n");

    expect(lines[0]?.startsWith("campaignName,channelName,campaignSource")).toBe(true);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("ASMRFIXY_YT_R1");
  });

  it("renders nulls as empty cells", () => {
    expect(buildCampaignsCsv([campaign]).split("\n")[1]?.endsWith(",")).toBe(true);
  });

  it("quotes values containing commas or quotes", () => {
    const csv = buildCampaignsCsv([
      { ...campaign, channelName: 'Fixy, "the" ASMR guy' },
    ]);

    expect(csv).toContain('"Fixy, ""the"" ASMR guy"');
  });

  it("emits only a header for an empty selection", () => {
    expect(buildCampaignsCsv([]).split("\n")).toHaveLength(1);
  });
});
