import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const BOS_HEADER_SOURCES = [
  "/login",
  "/owner/:path*",
  "/employees/:path*",
  "/sheet/:path*",
  "/stock/:path*",
  "/dispatch/:path*",
  "/finance/:path*",
  "/field/:path*",
  "/crm/:path*",
  "/clients/:path*",
  "/serm/:path*",
  "/ads/:path*",
  "/reviews/:path*",
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootDir,
  async rewrites() {
    return [
      // Serve static marketing homepage from public/index.html
      { source: "/", destination: "/index.html" },
    ];
  },
  async headers() {
    return BOS_HEADER_SOURCES.map((source) => ({
      source,
      headers: SECURITY_HEADERS,
    }));
  },
};

export default nextConfig;
