import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("next config", () => {
  it("keeps argon2 external to the server bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("argon2");
  });

  it("allows YouTube-hosted channel thumbnails for next/image", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "https",
          hostname: "yt3.ggpht.com"
        })
      ])
    );
  });
});
