import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the bundled demo seed with every serverless function so the deployed
  // demo boots populated (see src/lib/store.ts ensureDataDir).
  outputFileTracingIncludes: {
    "/**": ["./data-seed/**"],
  },
};

export default nextConfig;
