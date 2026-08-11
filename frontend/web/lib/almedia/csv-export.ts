import type { AlmediaCampaignRow } from "@scouting-platform/contracts";

/**
 * Client-side CSV export of the filtered campaign table. Browser-only — it
 * builds a Blob and clicks a synthetic anchor, so it must not run on the server.
 */

const CAMPAIGN_CSV_COLUMNS: ReadonlyArray<keyof AlmediaCampaignRow> = [
  "campaignName",
  "channelName",
  "campaignSource",
  "platform",
  "country",
  "publishedAt",
  "cost",
  "expectedCpm",
  "viewCount",
  "signupsPct",
  "roasD7pD14",
  "roasReturn",
  "returnPct",
  "appuD14",
  "d7Purchases",
  "videoUrl",
];

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Render campaigns as CSV text — pure, so it can be unit-tested directly. */
export function buildCampaignsCsv(campaigns: readonly AlmediaCampaignRow[]): string {
  return [
    CAMPAIGN_CSV_COLUMNS.join(","),
    ...campaigns.map((row) =>
      CAMPAIGN_CSV_COLUMNS.map((column) => escapeCsvValue(row[column])).join(","),
    ),
  ].join("\n");
}

export function downloadCampaignsCsv(
  campaigns: readonly AlmediaCampaignRow[],
  fileName = "almedia-campaigns-filtered.csv",
): void {
  const url = URL.createObjectURL(
    new Blob([buildCampaignsCsv(campaigns)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
