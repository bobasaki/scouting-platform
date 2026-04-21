import { describe, expect, it } from "vitest";

import {
  buildCatalogScoutingQuery,
  hasCatalogScoutingCriteria,
  isCatalogScoutingQuery,
  normalizeCatalogScoutingCriteria,
  parseCatalogScoutingQuery,
} from "./scouting-query";

describe("scouting query helpers", () => {
  it("normalizes and detects whether any catalog scouting criteria were provided", () => {
    expect(
      normalizeCatalogScoutingCriteria({
        subscribers: " 100K+ ",
        language: " English ",
      }),
    ).toEqual({
      subscribers: "100K+",
      views: "",
      location: "",
      language: "English",
      lastPostDaysSince: "",
      category: "",
      niche: "",
    });
    expect(hasCatalogScoutingCriteria({ subscribers: "  " })).toBe(false);
    expect(hasCatalogScoutingCriteria({ subscribers: "100K+" })).toBe(true);
  });

  it("builds and parses catalog scouting query strings", () => {
    const query = buildCatalogScoutingQuery({
      subscribers: "100K+",
      views: "25K-250K",
      location: "Germany",
      language: "German",
      lastPostDaysSince: "30",
      category: "Gaming",
      niche: "Strategy",
    });

    expect(isCatalogScoutingQuery(query)).toBe(true);
    expect(parseCatalogScoutingQuery(query)).toEqual({
      subscribers: "100K+",
      views: "25K-250K",
      location: "Germany",
      language: "German",
      lastPostDaysSince: "30",
      category: "Gaming",
      niche: "Strategy",
    });
  });
});
