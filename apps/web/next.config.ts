import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native password hashing must stay external so Docker/arm64 auth can resolve argon2 bindings.
  serverExternalPackages: ["argon2"],
  transpilePackages: [
    "@scouting-platform/contracts",
    "@scouting-platform/core",
    "@scouting-platform/db"
  ]
};

export default nextConfig;
