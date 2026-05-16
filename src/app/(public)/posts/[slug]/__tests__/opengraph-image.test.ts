import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  postFindFirst: vi.fn(),
}));

const blogSettingsMocks = vi.hoisted(() => ({
  getBlogSettings: vi.fn(),
}));

const imageResponseMocks = vi.hoisted(() => ({
  ImageResponse: vi.fn(function ImageResponse() {
    return new Response("mock png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findFirst: prismaMocks.postFindFirst },
  },
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: blogSettingsMocks.getBlogSettings,
}));

vi.mock("next/og", () => ({
  ImageResponse: imageResponseMocks.ImageResponse,
}));

describe("/posts/[slug]/opengraph-image", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
    );
    blogSettingsMocks.getBlogSettings.mockResolvedValue({
      siteName: "RSS Blog",
      siteDescription: "RSS Description",
      siteUrl: "https://rss.example",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns a png ImageResponse for a published article", async () => {
    prismaMocks.postFindFirst.mockResolvedValueOnce({
      title: "Article OG Title",
      excerpt: "Article excerpt",
      seoDescription: "Article SEO description",
      createdAt: new Date("2026-03-01T00:00:00Z"),
      publishedAt: new Date("2026-03-02T00:00:00Z"),
      author: { name: "Roy Dust" },
      category: { name: "Engineering" },
      tags: [{ name: "Next.js" }, { name: "Distribution" }],
    });

    const { default: Image, contentType, size } = await import("../opengraph-image");
    const response = await Image({ params: Promise.resolve({ slug: "hello-rss" }) });

    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(prismaMocks.postFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: "hello-rss", deletedAt: null, published: true },
        select: expect.objectContaining({
          title: true,
          seoDescription: true,
          author: { select: { name: true } },
          category: { select: { name: true } },
        }),
      }),
    );
    expect(imageResponseMocks.ImageResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        width: 1200,
        height: 630,
        fonts: [
          expect.objectContaining({
            name: "Alibaba PuHuiTi",
            weight: 600,
          }),
        ],
      }),
    );
  });
});
