import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootDir,
  async rewrites() {
    return [
      // Serve static marketing homepage from public/index.html
      { source: "/", destination: "/index.html" },
    ];
  },
};

export default nextConfig;
