import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/store",
  serverExternalPackages: ["googleapis"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
    middlewareClientMaxBodySize: "2gb",
  },
};

export default nextConfig;
