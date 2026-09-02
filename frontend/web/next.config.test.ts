import { describe, expect, it } from "vitest";

import { OPTIMIZED_IMAGE_HOSTS } from "./lib/image-hosts";
import nextConfig, {
  CANONICAL_PRODUCTION_ORIGIN,
  LEGACY_PRODUCTION_HOST,
  productionHostRedirects,
  securityHeaders,
} from "./next.config";

describe("next config", () => {
  it("keeps argon2 external to the server bundle", () => {
    expect(nextConfig.serverExternalPackages).toContain("argon2");
  });

  it("only optimizes images from the YouTube thumbnail CDNs, https only", () => {
    expect(nextConfig.images?.remotePatterns).toEqual(
      OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https", hostname })),
    );
  });

  it("permanently redirects every old-host path to the canonical origin", async () => {
    await expect(productionHostRedirects()).resolves.toEqual([
      {
        source: "/:path*",
        has: [{ type: "host", value: LEGACY_PRODUCTION_HOST }],
        destination: `${CANONICAL_PRODUCTION_ORIGIN}/:path*`,
        permanent: true,
      },
    ]);
  });

  it("attaches baseline security headers to every route", async () => {
    expect(nextConfig.headers).toBe(securityHeaders);

    await expect(securityHeaders()).resolves.toEqual([
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]);
  });

  it("leaves Strict-Transport-Security to the nginx layer", async () => {
    const rules = await securityHeaders();
    const keys = rules.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase()));

    expect(keys).not.toContain("strict-transport-security");
  });
});
