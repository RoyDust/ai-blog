import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const checkAiCoverRateLimit = vi.fn();
const generateAiCoverImage = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAiCoverRateLimit,
}));

vi.mock("@/lib/ai-cover-image", () => ({
  generateAiCoverImage,
}));

describe("POST /api/admin/covers/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1" } });
    checkAiCoverRateLimit.mockResolvedValue({ allowed: true });
    generateAiCoverImage.mockResolvedValue({ id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" });
  });

  test("requires rate limit and admin then generates cover", async () => {
    const { POST } = await import("../route");
    const request = new Request("http://localhost/api/admin/covers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hello", excerpt: "World", prompt: "dark", modelId: "qwen-wan2.6-image", size: "16:9" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { id: "cover-1", url: "https://cdn.example.com/covers/ai/a.png" } });
    expect(checkAiCoverRateLimit).toHaveBeenCalledWith(request);
    expect(requireAdminSession).toHaveBeenCalled();
    expect(generateAiCoverImage).toHaveBeenCalledWith(expect.objectContaining({
      title: "Hello",
      excerpt: "World",
      prompt: "dark",
      modelId: "qwen-wan2.6-image",
      size: "16:9",
      createdById: "admin-1",
    }));
  });

  test("returns 429 when limited", async () => {
    checkAiCoverRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/covers/generate", { method: "POST" }));

    expect(response.status).toBe(429);
    expect(generateAiCoverImage).not.toHaveBeenCalled();
  });
});
