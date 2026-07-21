import type { NextConfig } from "next";

export const LEGACY_PRODUCTION_HOST = "scouting.arch.business";
export const CANONICAL_PRODUCTION_ORIGIN = "https://atlas.arch.business";

export async function productionHostRedirects() {
  return [
    {
      source: "/:path*",
      has: [{ type: "host" as const, value: LEGACY_PRODUCTION_HOST }],
      destination: `${CANONICAL_PRODUCTION_ORIGIN}/:path*`,
      // Keep the first cutover rollback-friendly. Promote this to a permanent
      // redirect only after the new origin has been stable for 24-48 hours.
      permanent: false,
    },
  ];
}

const nextConfig: NextConfig = {
  // Standalone output bundles only the files needed for production,
  // enabling minimal Docker images and faster cold starts.
  output: "standalone",

  redirects: productionHostRedirects,

  // Native password hashing must stay external so Docker/arm64 auth can resolve argon2 bindings.
  serverExternalPackages: ["argon2"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },

  transpilePackages: [
    "@scouting-platform/contracts",
    "@scouting-platform/core",
    "@scouting-platform/db",
  ],

  // Aggressive module-level tree-shaking for smaller server bundles.
  experimental: {
    optimizePackageImports: [
      "@scouting-platform/contracts",
      "@scouting-platform/core",
    ],
  },
};

export default nextConfig;
