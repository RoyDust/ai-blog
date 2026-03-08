import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("admin post summarize route", () => {
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
      new Request("http://localhost/api/admin/posts/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  test("returns summary text from dashscope compatible api", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "这是生成的文章摘要。",
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "测试文章", content: "很长的正文内容" }),
      })
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
    expect(data).toMatchObject({ success: true, data: { summary: "这是生成的文章摘要。" } });
  });
});
