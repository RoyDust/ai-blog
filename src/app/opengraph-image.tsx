import { ImageResponse } from "next/og";
import { getBlogSettings } from "@/lib/blog-settings";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const fontDataPromise = fetch(new URL("../../public/font/AlibabaPuHuiTi-3-65-Medium.woff2", import.meta.url))
  .then((response) => response.arrayBuffer())
  .catch(() => null);

export default async function Image() {
  const [settings, fontData] = await Promise.all([getBlogSettings(), fontDataPromise]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f4ed",
          color: "#1f2a24",
          padding: "72px",
          fontFamily: "Alibaba PuHuiTi",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            fontSize: "28px",
            color: "#557166",
          }}
        >
          <span
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "999px",
              background: "#d89b4a",
              display: "flex",
            }}
          />
          {settings.siteUrl}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "92px",
              lineHeight: 1.02,
              letterSpacing: 0,
              maxWidth: "980px",
            }}
          >
            {settings.siteName}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "34px",
              lineHeight: 1.35,
              color: "#52645b",
              maxWidth: "920px",
            }}
          >
            {settings.siteDescription}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "24px",
            color: "#7b6f61",
          }}
        >
          <span>Long-form notes and engineering practice</span>
          <span>RSS / Blog / Archive</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [
            {
              name: "Alibaba PuHuiTi",
              data: fontData,
              style: "normal",
              weight: 600,
            },
          ]
        : undefined,
    },
  );
}
