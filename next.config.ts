import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
};

export default nextConfig;
