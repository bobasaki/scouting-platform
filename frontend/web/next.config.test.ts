import { describe, expect, it } from "vitest";

import nextConfig, {
  CANONICAL_PRODUCTION_ORIGIN,
  LEGACY_PRODUCTION_HOST,
  productionHostRedirects,
} from "./next.config";

describe("next config", () => {
  it("keeps argon2 external to the server bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("argon2");
  });

  it("permits next/image to load thumbnails from any remote host", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          protocol: "https",
          hostname: "**"
        })
      ])
    );
  });

  it("temporarily redirects every old-host path to the canonical origin", async () => {
    await expect(productionHostRedirects()).resolves.toEqual([
      {
        source: "/:path*",
        has: [{ type: "host", value: LEGACY_PRODUCTION_HOST }],
        destination: `${CANONICAL_PRODUCTION_ORIGIN}/:path*`,
        permanent: false,
      },
    ]);
  });
});
