import { describe, expect, it } from "vitest";
import { APP_TITLE, DEFAULT_APP_ROLE } from "./shell";

describe("web shell constants", () => {
  it("defines the app title", () => {
    expect(APP_TITLE).toBe("Scouting Platform");
  });

  it("uses user role as the temporary authenticated shell baseline", () => {
    expect(DEFAULT_APP_ROLE).toBe("user");
  });
});
