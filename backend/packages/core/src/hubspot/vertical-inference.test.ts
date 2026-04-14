import { describe, expect, it } from "vitest";

import {
  inferVerticalsForHubspot,
  serializeHubspotMultiSelect,
} from "./vertical-inference";

function buildStructuredProfile(input: {
  primary: string;
  secondary?: string[];
}) {
  return {
    primaryNiche: input.primary,
    secondaryNiches: input.secondary ?? [],
    contentFormats: ["long_form"],
    brandFitTags: [],
    language: "en",
    geoHints: [],
    sponsorSignals: [],
    brandSafety: {
      status: "low",
      flags: [],
      rationale: "Safe",
    },
  };
}

describe("inferVerticalsForHubspot", () => {
  it("returns multiple independent verticals", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: buildStructuredProfile({
        primary: "gaming",
        secondary: ["tech"],
      }),
      topics: ["pc builds"],
      audienceInterests: [],
    })).toEqual(["Gaming", "Tech"]);
  });

  it("prefers stronger signals first", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: buildStructuredProfile({
        primary: "beauty",
      }),
      topics: ["fashion"],
      audienceInterests: [],
    })).toEqual(["Beauty", "Fashion"]);
  });

  it("uses audience interests as supporting evidence", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: buildStructuredProfile({
        primary: "commentary_reaction",
        secondary: ["tech"],
      }),
      topics: [],
      audienceInterests: [{ label: "Tech", score: 0.88 }],
    })).toEqual(["Commentary", "Tech"]);
  });

  it("suppresses broad parents when only the child is supported", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: null,
      topics: ["minecraft"],
      audienceInterests: [],
    })).toEqual(["Minecraft"]);
  });

  it("is case insensitive and supports partial matching", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: null,
      topics: ["GAMING", "pc gaming"],
      audienceInterests: [],
    })).toEqual(["Gaming"]);
  });

  it("returns empty for null, empty, and unmatched input", () => {
    expect(inferVerticalsForHubspot({
      structuredProfile: null,
      topics: null,
      audienceInterests: null,
    })).toEqual([]);
    expect(inferVerticalsForHubspot({
      structuredProfile: null,
      topics: [],
      audienceInterests: [],
    })).toEqual([]);
    expect(inferVerticalsForHubspot({
      structuredProfile: "not an object",
      topics: ["obscure niche"],
      audienceInterests: "not an array",
    })).toEqual([]);
  });
});

describe("serializeHubspotMultiSelect", () => {
  it("serializes unique values in order", () => {
    expect(serializeHubspotMultiSelect(["Gaming", "Tech", "Gaming"])).toBe("Gaming;Tech");
  });
});
