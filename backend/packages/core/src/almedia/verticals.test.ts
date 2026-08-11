import type { AlmediaChannelEnrichment } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { canonicalVertical, deriveVerticals, VERTICALS } from "./verticals";

function enrichment(
  overrides: Partial<{
    niche: string;
    topics: readonly string[];
    categories: readonly string[];
    channelTopics: readonly string[];
    keywords: readonly string[];
    positioning: string;
    summary: string;
    description: string;
  }> = {},
): AlmediaChannelEnrichment {
  return {
    channel: {
      id: "UC1",
      title: "Test creator",
      description: overrides.description ?? "",
      country: null,
      topics: [...(overrides.channelTopics ?? [])],
      keywords: [...(overrides.keywords ?? [])],
    },
    metrics: {
      followers: 1000,
      typicalViews: { median: 500 },
      typicalEngagementRatePct: 2,
      contentFormat: { dominant: "long_form" },
    },
    classification: {
      niche: overrides.niche ?? "",
      topics: [...(overrides.topics ?? [])],
      audiencePositioning: overrides.positioning ?? "",
      brandFit: {
        suitability: "medium",
        categories: [...(overrides.categories ?? [])],
      },
      brandSafety: { risk: "low" },
    },
    summary: overrides.summary ?? "",
  };
}

describe("canonicalVertical", () => {
  it("matches the controlled vocabulary case- and whitespace-insensitively", () => {
    expect(canonicalVertical("gaming")).toBe("Gaming");
    expect(canonicalVertical("  ASMR ")).toBe("ASMR");
    expect(canonicalVertical("home decor")).toBe("Home Decor");
  });

  it("returns null for values outside the vocabulary", () => {
    expect(canonicalVertical("Crypto Shilling")).toBeNull();
    expect(canonicalVertical("")).toBeNull();
    expect(canonicalVertical(null)).toBeNull();
    expect(canonicalVertical(undefined)).toBeNull();
  });

  it("keeps the vocabulary free of duplicates", () => {
    expect(new Set(VERTICALS).size).toBe(VERTICALS.length);
  });
});

describe("deriveVerticals", () => {
  it("leads with the classifier's own niche", () => {
    expect(deriveVerticals(enrichment({ niche: "gaming" }))).toEqual(["Gaming"]);
  });

  it("returns at most two verticals, strongest first", () => {
    expect(
      deriveVerticals(
        enrichment({ niche: "documentary", topics: ["true crime", "mystery"] }),
      ),
    ).toEqual(["Crimes", "Documentary"]);
  });

  it("drops a runner-up the winner leaves far behind", () => {
    expect(
      deriveVerticals(
        enrichment({
          niche: "true crime",
          topics: ["criminal cases", "documentary", "police investigation"],
        }),
      ),
    ).toEqual(["Crimes"]);
  });

  it("honours a lower maximum and refuses a nonsensical one", () => {
    const input = enrichment({
      niche: "true crime",
      topics: ["documentary", "criminal cases"],
    });

    expect(deriveVerticals(input, 1)).toEqual(["Crimes"]);
    expect(deriveVerticals(input, 0)).toEqual([]);
  });

  it("prefers a specific vertical over the generic one it sits inside", () => {
    const result = deriveVerticals(
      enrichment({
        niche: "true crime",
        topics: ["entertainment", "criminal cases"],
        channelTopics: ["Entertainment"],
      }),
    );

    expect(result[0]).toBe("Crimes");
  });

  it("ignores a keyword that only appears inside a longer word", () => {
    expect(
      deriveVerticals(
        enrichment({ niche: "startup founders", summary: "starting a business" }),
      ),
    ).toEqual([]);
  });

  it("matches through accents and punctuation", () => {
    expect(deriveVerticals(enrichment({ niche: "Pokémon Cards" }))).toEqual([
      "Pokemon Cards",
    ]);
  });

  it("returns nothing without an enrichment or a scoring signal", () => {
    expect(deriveVerticals(null)).toEqual([]);
    expect(deriveVerticals(undefined)).toEqual([]);
    expect(deriveVerticals(enrichment())).toEqual([]);
  });
});
