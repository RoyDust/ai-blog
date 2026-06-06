import { beforeEach, describe, expect, test, vi } from "vitest";

const getRecommendedPostsForPost = vi.fn();
const getServerSession = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/recommendations", () => ({
  getRecommendedPostsForPost,
}));

describe("GET /api/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecommendedPostsForPost.mockResolvedValue([{ id: "p2", title: "Next", slug: "next" }]);
    getServerSession.mockResolvedValue(null);
  });

  test("returns recommendations for a post", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/recommendations?postId=post-1&limit=4"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, data: [{ id: "p2", title: "Next", slug: "next" }] });
    expect(getRecommendedPostsForPost).toHaveBeenCalledWith({
      postId: "post-1",
      limit: 4,
      userId: null,
      excludeRead: false,
    });
  });

  test("rejects missing postId", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/recommendations"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("postId is required");
    expect(getRecommendedPostsForPost).not.toHaveBeenCalled();
  });

  test("passes the authenticated user when excluding read posts", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/recommendations?postId=post-1&excludeRead=true"));

    expect(response.status).toBe(200);
    expect(getRecommendedPostsForPost).toHaveBeenCalledWith({
      postId: "post-1",
      limit: 10,
      userId: "user-1",
      excludeRead: true,
    });
  });
});
