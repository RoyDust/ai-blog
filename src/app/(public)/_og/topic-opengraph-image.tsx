import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const fontDataPromise = fetch(
  new URL("../../../../public/font/AlibabaPuHuiTi-3-65-Medium.woff2", import.meta.url),
)
  .then((response) => response.arrayBuffer())
  .catch(() => null);

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export async function renderTopicOpenGraphImage({
  siteName,
  badge,
  title,
  description,
  countLabel,
}: {
  siteName: string;
  badge: string;
  title: string;
  description: string;
  countLabel: string;
}) {
  const fontData = await fontDataPromise;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf6",
          color: "#1d2721",
          padding: "64px",
          fontFamily: "Alibaba PuHuiTi",
          border: "24px solid #e7ddcc",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", fontSize: "26px", color: "#5f7369" }}>
            <span
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "999px",
                background: "#d39642",
                display: "flex",
              }}
            />
            {siteName}
          </div>
          <div
            style={{
              border: "2px solid #cfc2ad",
              borderRadius: "999px",
              padding: "10px 18px",
              fontSize: "22px",
              color: "#6d5f4d",
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "88px", lineHeight: 1.08, letterSpacing: 0, maxWidth: "1000px" }}>
            {truncate(title, 36)}
          </h1>
          <p style={{ margin: 0, fontSize: "30px", lineHeight: 1.38, color: "#5c685f", maxWidth: "940px" }}>
            {truncate(description, 118)}
          </p>
        </div>

        <div style={{ fontSize: "24px", color: "#6d5f4d" }}>{countLabel}</div>
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
