import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("admin post review route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-api-key",
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
        headers: expect.objectContaining({ Authorization: "Bearer test-api-key" }),
      })
    );
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
});
