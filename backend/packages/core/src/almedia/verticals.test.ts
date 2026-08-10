import { describe, expect, it } from "vitest";

import { canonicalVertical, VERTICALS } from "./verticals";

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
