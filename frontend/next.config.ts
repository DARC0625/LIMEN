import type { NextConfig } from "next";

// Backend and Agent URLs - use environment variables or fallback to localhost
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:9000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/health_proxy',
        destination: `${backendUrl}/api/health`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
      {
        source: '/agent/:path*',
        destination: `${agentUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
