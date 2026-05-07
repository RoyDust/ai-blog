import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/taxonomy", () => ({
  getCategoryDirectory: vi.fn(),
  getTagDirectory: vi.fn(),
}));

describe("admin post metadata route", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-api-key",
      DASHSCOPE_MODEL: "qwen3.5-flash",
    };

    const { getCategoryDirectory, getTagDirectory } = await import("@/lib/taxonomy");
    vi.mocked(getCategoryDirectory).mockResolvedValue([
      { id: "cat-1", name: "前端", slug: "frontend", description: null, createdAt: new Date(), _count: { posts: 4 } },
      { id: "cat-2", name: "后端", slug: "backend", description: null, createdAt: new Date(), _count: { posts: 2 } },
    ] as never);
    vi.mocked(getTagDirectory).mockResolvedValue([
      { id: "tag-1", name: "React", slug: "react", color: null, createdAt: new Date(), _count: { posts: 3 } },
      { id: "tag-2", name: "Next.js", slug: "nextjs", color: null, createdAt: new Date(), _count: { posts: 2 } },
      { id: "tag-3", name: "Prisma", slug: "prisma", color: null, createdAt: new Date(), _count: { posts: 1 } },
    ] as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("rejects non-admin requests", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  test("generates normalized metadata constrained to existing taxonomy", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Next.js AI 元信息补全实践",
                slug: "Next.js AI Metadata!",
                excerpt: "介绍如何在博客后台中用 AI 一次性补齐标题、摘要、分类和标签。",
                categorySlug: "frontend",
                tagSlugs: ["nextjs", "react", "unknown"],
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "草稿标题", content: "# 正文\n\n这是一篇关于 Next.js 和 AI 写作体验的文章。" }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-api-key" }),
      })
    );
    expect(payload).toMatchObject({
      success: true,
      data: {
        title: "Next.js AI 元信息补全实践",
        slug: "next-js-ai-metadata",
        excerpt: "介绍如何在博客后台中用 AI 一次性补齐标题、摘要、分类和标签。",
        categorySlug: "frontend",
        tagSlugs: ["nextjs", "react"],
      },
    });
  });

  test("generates only slug when field is slug", async () => {
    const { getServerSession } = await import("next-auth");
    const { getCategoryDirectory, getTagDirectory } = await import("@/lib/taxonomy");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ slug: "AI Generated Slug!" }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "slug", title: "草稿标题" }),
      })
    );

    const payload = await response.json();
    const requestBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: { slug: "ai-generated-slug" },
    });
    expect(requestBody).toMatchObject({ max_tokens: 80 });
    expect(String(requestBody.messages[1].content)).toContain("JSON 字段：slug");
    expect(String(requestBody.messages[1].content)).not.toContain("JSON 字段：title, slug, excerpt, categorySlug, tagSlugs");
    expect(getCategoryDirectory).not.toHaveBeenCalled();
    expect(getTagDirectory).not.toHaveBeenCalled();
  });

  test("generates only category when field is category", async () => {
    const { getServerSession } = await import("next-auth");
    const { getCategoryDirectory, getTagDirectory } = await import("@/lib/taxonomy");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ categorySlug: "frontend" }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "category", title: "草稿标题", content: "这是一篇关于 React 的文章。" }),
      })
    );

    const payload = await response.json();
    const requestBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: { categorySlug: "frontend" },
    });
    expect(requestBody).toMatchObject({ max_tokens: 80 });
    expect(String(requestBody.messages[1].content)).toContain("JSON 字段：categorySlug");
    expect(String(requestBody.messages[1].content)).toContain("可选分类");
    expect(String(requestBody.messages[1].content)).not.toContain("可选标签");
    expect(getCategoryDirectory).toHaveBeenCalledTimes(1);
    expect(getTagDirectory).not.toHaveBeenCalled();
  });

  test("generates only tags when field is tags", async () => {
    const { getServerSession } = await import("next-auth");
    const { getCategoryDirectory, getTagDirectory } = await import("@/lib/taxonomy");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ tagSlugs: ["react", "nextjs", "unknown"] }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "tags", title: "草稿标题", content: "这是一篇关于 React 和 Next.js 的文章。" }),
      })
    );

    const payload = await response.json();
    const requestBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: { tagSlugs: ["react", "nextjs"] },
    });
    expect(requestBody).toMatchObject({ max_tokens: 160 });
    expect(String(requestBody.messages[1].content)).toContain("JSON 字段：tagSlugs");
    expect(String(requestBody.messages[1].content)).toContain("可选标签");
    expect(String(requestBody.messages[1].content)).not.toContain("可选分类");
    expect(getCategoryDirectory).not.toHaveBeenCalled();
    expect(getTagDirectory).toHaveBeenCalledTimes(1);
  });
});
