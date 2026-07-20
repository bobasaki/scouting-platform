import { describe, expect, it } from "vitest";

import { patchChannelManualOverridesRequestSchema } from "./channels";

describe("channel manual override contracts", () => {
  it("accepts country set and clear operations", () => {
    expect(patchChannelManualOverridesRequestSchema.parse({
      operations: [
        { field: "countryRegion", op: "set", value: "Croatia" },
      ],
    })).toEqual({
      operations: [
        { field: "countryRegion", op: "set", value: "Croatia" },
      ],
    });

    expect(patchChannelManualOverridesRequestSchema.safeParse({
      operations: [
        { field: "countryRegion", op: "clear" },
      ],
    }).success).toBe(true);
  });
});
