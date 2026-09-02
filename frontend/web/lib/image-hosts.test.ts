import { describe, expect, it } from "vitest";

import { isOptimizedImageHost, OPTIMIZED_IMAGE_HOSTS } from "./image-hosts";

describe("isOptimizedImageHost", () => {
  it.each(OPTIMIZED_IMAGE_HOSTS)("accepts https URLs on %s", (host) => {
    expect(isOptimizedImageHost(`https://${host}/some/thumb.jpg`)).toBe(true);
  });

  it("rejects http URLs even on allowed hosts", () => {
    expect(isOptimizedImageHost("http://i.ytimg.com/some/thumb.jpg")).toBe(false);
  });

  it("rejects hosts outside the allowlist", () => {
    expect(isOptimizedImageHost("https://cdn.instagram.com/avatar.jpg")).toBe(false);
    expect(isOptimizedImageHost("https://evil.example.com/i.ytimg.com")).toBe(false);
  });

  it("rejects values that are not valid URLs", () => {
    expect(isOptimizedImageHost("not a url")).toBe(false);
    expect(isOptimizedImageHost("")).toBe(false);
  });
});
