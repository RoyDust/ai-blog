import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const prismaMocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: {
      findMany: prismaMocks.findManyMock,
      findUnique: prismaMocks.findUniqueMock,
      count: prismaMocks.countMock,
    },
  },
}));

describe("admin post review route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    prismaMocks.findManyMock.mockResolvedValue([]);
    prismaMocks.findUniqueMock.mockResolvedValue(null);
    prismaMocks.countMock.mockResolvedValue(0);
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-api-key",
      DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      DASHSCOPE_MODEL: "qwen3.5-flash",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("rejects non-admin requests", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "测试", slug: "test", content: "hello", coverImage: "" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  test("returns normalized AI review report", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: "needs-work",
                score: 72,
                summary: "文章方向清晰，但发布前需要补充结论和封面。",
                checks: [
                  { label: "标题", status: "pass", detail: "标题具体" },
                  { label: "结构", status: "warn", detail: "缺少收束段" },
                  { label: "事实", status: "fail", detail: "有未注明来源的数据" },
                ],
                suggestions: ["补充结论", "增加封面图"],
              }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Next.js AI 审稿实践",
          slug: "nextjs-ai-review",
          content: "# 正文\n\n" + "这是一段文章内容。".repeat(30),
          coverImage: "",
        }),
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer test-api-key" }),
      })
    );
    const upstreamBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body));
    expect(upstreamBody).toMatchObject({
      max_tokens: 1400,
    });
    expect(String(upstreamBody.messages[1]?.content)).toContain("审稿基准日期");
    expect(String(upstreamBody.messages[1]?.content)).toContain("不要仅因年份或日期本身判定为未来内容");
    expect(payload).toMatchObject({
      success: true,
      data: {
        verdict: "needs-work",
        score: 72,
        summary: "文章方向清晰，但发布前需要补充结论和封面。",
        checks: [
          { label: "标题", status: "pass", detail: "标题具体" },
          { label: "结构", status: "warn", detail: "缺少收束段" },
          { label: "事实", status: "fail", detail: "有未注明来源的数据" },
        ],
        suggestions: ["补充结论", "增加封面图"],
      },
    });
  });

  test("extracts the first balanced JSON object from review model chatter", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: `可以，下面是审稿 JSON：\n{"verdict":"ready","score":91,"summary":"可以发布。","checks":[{"label":"事实","status":"pass","detail":"引用清晰"}],"suggestions":[]}\n请查收。`,
            },
          },
        ],
      }),
    }));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "AI 日报",
          slug: "ai-daily",
          content: "# 正文\n\n" + "这是一段文章内容。".repeat(30),
        }),
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        verdict: "ready",
        score: 91,
        summary: "可以发布。",
      },
    });
  });

  test("returns 400 Invalid JSON payload on malformed JSON and never echoes raw error.message on 500", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const { POST } = await import("../route");
    const malformedResponse = await POST(
      new Request("http://localhost/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"title":"AI","apiKey":"sk-secret"',
      }),
    );

    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({ error: "Invalid JSON payload" });

    prismaMocks.findManyMock.mockRejectedValueOnce(new Error("internal db secret sk-secret"));
    const errorResponse = await POST(
      new Request("http://localhost/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "AI", slug: "ai", content: "正文" }),
      }),
    );

    expect(errorResponse.status).toBe(500);
    await expect(errorResponse.json()).resolves.toEqual({ error: "Review generation failed" });
  });
});
