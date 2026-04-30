import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAiClient = vi.fn();
const getCategoryDirectory = vi.fn();
const getTagDirectory = vi.fn();

vi.mock("@/lib/ai-auth", () => ({
  requireAiClient,
}));

vi.mock("@/lib/taxonomy", () => ({
  getCategoryDirectory,
  getTagDirectory,
}));

describe("GET /api/ai/meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns live taxonomy and authoring limits", async () => {
    requireAiClient.mockResolvedValueOnce({ id: "client-1" });
    getCategoryDirectory.mockResolvedValueOnce([{ name: "Engineering", slug: "engineering", _count: { posts: 4 } }]);
    getTagDirectory.mockResolvedValueOnce([{ name: "Next.js", slug: "nextjs", _count: { posts: 2 } }]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/ai/meta", {
      headers: { Authorization: "Bearer blog_ai_token_123" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.categories).toEqual([{ name: "Engineering", slug: "engineering", postCount: 4 }]);
    expect(payload.data.tags).toEqual([{ name: "Next.js", slug: "nextjs", postCount: 2 }]);
    expect(payload.data.limits.publishRequiresHumanReview).toBe(false);
    expect(payload.data.limits.autoPublishRequiresAiReview).toBe(true);
    expect(payload.data.limits.autoPublishMinimumScore).toBe(85);
  });
});
