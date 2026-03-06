import type { NextConfig } from "next";

const qiniuDomain = process.env.QINIU_DOMAIN;
const qiniuUrl = qiniuDomain ? new URL(qiniuDomain) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      ...(qiniuUrl
        ? [
            {
              protocol: qiniuUrl.protocol.replace(":", "") as "http" | "https",
              hostname: qiniuUrl.hostname,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
