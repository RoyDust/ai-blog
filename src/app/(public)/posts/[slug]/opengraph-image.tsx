import { ImageResponse } from "next/og";
import { getBlogSettings } from "@/lib/blog-settings";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const fontDataPromise = fetch(
  new URL("../../../../../public/font/AlibabaPuHuiTi-3-65-Medium.woff2", import.meta.url),
)
  .then((response) => response.arrayBuffer())
  .catch(() => null);

async function getPost(slug: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.post.findFirst({
    where: { slug, deletedAt: null, published: true },
    select: {
      title: true,
      excerpt: true,
      seoDescription: true,
      createdAt: true,
      publishedAt: true,
      author: { select: { name: true } },
      category: { select: { name: true } },
      tags: { where: { deletedAt: null }, select: { name: true }, take: 3 },
    },
  });
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [settings, post, fontData] = await Promise.all([getBlogSettings(), getPost(slug), fontDataPromise]);

  const title = truncate(post?.title || settings.siteName, 64);
  const description = truncate(post?.seoDescription || post?.excerpt || settings.siteDescription, 118);
  const authorName = post?.author.name || settings.siteName;
  const publishedDate = post ? formatDate(post.publishedAt || post.createdAt) : "Blog";
  const categoryName = post?.category?.name || "Article";
  const tags = post?.tags.map((tag) => tag.name) ?? [];

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
            {settings.siteName}
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
            {categoryName}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h1 style={{ margin: 0, fontSize: "76px", lineHeight: 1.08, letterSpacing: 0, maxWidth: "1000px" }}>
            {title}
          </h1>
          <p style={{ margin: 0, fontSize: "30px", lineHeight: 1.38, color: "#5c685f", maxWidth: "940px" }}>
            {description}
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", color: "#6d5f4d", fontSize: "24px" }}>
            <span>{authorName}</span>
            <span>{publishedDate}</span>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  borderRadius: "999px",
                  background: "#1f2a24",
                  color: "#fffaf0",
                  padding: "9px 14px",
                  fontSize: "20px",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
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
