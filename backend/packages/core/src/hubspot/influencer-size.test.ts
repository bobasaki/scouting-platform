import { describe, expect, it } from "vitest";

import { computeInfluencerSizeTier } from "./influencer-size";

describe("computeInfluencerSizeTier", () => {
  it("returns empty for null and undefined", () => {
    expect(computeInfluencerSizeTier(null)).toBe("");
    expect(computeInfluencerSizeTier(undefined)).toBe("");
  });

  it("returns empty below 1K", () => {
    expect(computeInfluencerSizeTier(999)).toBe("");
  });

  it("returns the correct tier at each boundary", () => {
    expect(computeInfluencerSizeTier(1_000)).toBe("Nano (1K - 5K)");
    expect(computeInfluencerSizeTier(4_999)).toBe("Nano (1K - 5K)");
    expect(computeInfluencerSizeTier(5_000)).toBe("Micro (5K - 20K)");
    expect(computeInfluencerSizeTier(19_999)).toBe("Micro (5K - 20K)");
    expect(computeInfluencerSizeTier(20_000)).toBe("Mid-tier (20K - 100K)");
    expect(computeInfluencerSizeTier(99_999)).toBe("Mid-tier (20K - 100K)");
    expect(computeInfluencerSizeTier(100_000)).toBe("Macro (100K - 500K)");
    expect(computeInfluencerSizeTier(499_999)).toBe("Macro (100K - 500K)");
    expect(computeInfluencerSizeTier(500_000)).toBe("Mega (500K - 1M)");
    expect(computeInfluencerSizeTier(999_999)).toBe("Mega (500K - 1M)");
    expect(computeInfluencerSizeTier(1_000_000)).toBe("Macro-tier (1M+)");
    expect(computeInfluencerSizeTier(5_000_000)).toBe("Macro-tier (1M+)");
  });

  it("handles bigint values", () => {
    expect(computeInfluencerSizeTier(250_000n)).toBe("Macro (100K - 500K)");
  });

  it("returns empty for negative, NaN, and Infinity", () => {
    expect(computeInfluencerSizeTier(-1)).toBe("");
    expect(computeInfluencerSizeTier(Number.NaN)).toBe("");
    expect(computeInfluencerSizeTier(Number.POSITIVE_INFINITY)).toBe("");
  });
});
