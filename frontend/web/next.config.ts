import type { NextConfig } from "next";

import { OPTIMIZED_IMAGE_HOSTS } from "./lib/image-hosts";

export const LEGACY_PRODUCTION_HOST = "scouting.arch.business";
export const CANONICAL_PRODUCTION_ORIGIN = "https://atlas.arch.business";

export async function productionHostRedirects() {
  return [
    {
      source: "/:path*",
      has: [{ type: "host" as const, value: LEGACY_PRODUCTION_HOST }],
      destination: `${CANONICAL_PRODUCTION_ORIGIN}/:path*`,
      // The atlas.arch.business cutover (2026-07-21) is long past its
      // stability window, so browsers may cache this redirect (308).
      permanent: true,
    },
  ];
}

/**
 * Baseline security headers for every route.
 *
 * Strict-Transport-Security is intentionally absent: the Dokku nginx layer in
 * front of the app already sends it, and a second copy would be an invalid
 * duplicate header.
 */
export async function securityHeaders() {
  return [
    {
      source: "/:path*",
      headers: [
        // Directives here are the ones that cannot break Next's inline
        // runtime scripts; a nonce-based script-src needs middleware first.
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
  ];
}

const nextConfig: NextConfig = {
  // Standalone output bundles only the files needed for production,
  // enabling minimal Docker images and faster cold starts.
  output: "standalone",

  redirects: productionHostRedirects,

  headers: securityHeaders,

  // Native password hashing must stay external so Docker/arm64 auth can resolve argon2 bindings.
  serverExternalPackages: ["argon2"],

  images: {
    // Only these hosts may be fetched through /_next/image; components render
    // any other stored thumbnail URL with `unoptimized` (see lib/image-hosts).
    remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
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
