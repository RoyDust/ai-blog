import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: blogSettingsMocks.getBlogSettings,
}));

vi.mock("next/og", () => ({
  ImageResponse: imageResponseMocks.ImageResponse,
}));

describe("/opengraph-image", () => {
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

  test("returns a png ImageResponse for the site fallback", async () => {
    const { default: Image, contentType, size } = await import("../opengraph-image");
    const response = await Image();

    expect(contentType).toBe("image/png");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(response.headers.get("content-type")).toBe("image/png");
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
