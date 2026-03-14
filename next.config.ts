import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const qiniuDomain = process.env.QINIU_DOMAIN;
const qiniuUrl = qiniuDomain ? new URL(qiniuDomain) : null;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    dangerouslyAllowLocalIP: true,
    qualities: [70, 75],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "project.roydust.top",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "project.roydust.top",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      ...(qiniuUrl
        ? [
            {
              protocol: qiniuUrl.protocol.replace(":", "") as "http" | "https",
              hostname: qiniuUrl.hostname,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
