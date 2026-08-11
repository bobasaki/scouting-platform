import { describe, expect, it } from "vitest";

import { getMaturityInfo, getReturnTier, getSizeTier } from "./analytics";

describe("getReturnTier", () => {
  it("uses the agreed return tier boundaries", () => {
    expect(getReturnTier(100.01)).toBe("longterm");
    expect(getReturnTier(100)).toBe("rebooking");
    expect(getReturnTier(80)).toBe("rebooking");
    expect(getReturnTier(79.99)).toBe("price_adjusted");
    expect(getReturnTier(50)).toBe("price_adjusted");
    expect(getReturnTier(49.99)).toBe("drop");
    expect(getReturnTier(null)).toBeNull();
  });
});

describe("getMaturityInfo", () => {
  it("marks campaigns as matured exactly 14 days after publication", () => {
    const now = new Date("2026-07-15T12:00:00Z");

    expect(getMaturityInfo("2026-07-01T12:00:00Z", now)).toEqual({
      status: "matured",
      daysRemaining: 0,
    });
    expect(getMaturityInfo("2026-07-02T12:00:00Z", now)).toEqual({
      status: "maturing",
      daysRemaining: 1,
    });
    expect(getMaturityInfo(null, now)).toEqual({
      status: "unknown",
      daysRemaining: null,
    });
  });

  it("treats an unparseable date as unknown rather than throwing", () => {
    expect(getMaturityInfo("not-a-date", new Date("2026-07-15T12:00:00Z"))).toEqual({
      status: "unknown",
      daysRemaining: null,
    });
  });
});

describe("getSizeTier", () => {
  it("bands deals at 10k / 20k / 50k", () => {
    expect(getSizeTier(9_999)).toBe("<10k");
    expect(getSizeTier(10_000)).toBe("10-20k");
    expect(getSizeTier(19_999)).toBe("10-20k");
    expect(getSizeTier(20_000)).toBe("20-50k");
    expect(getSizeTier(50_000)).toBe("20-50k");
    expect(getSizeTier(50_001)).toBe(">50k");
  });

  it("returns null without a usable amount", () => {
    expect(getSizeTier(null)).toBeNull();
    expect(getSizeTier(Number.NaN)).toBeNull();
  });
});
