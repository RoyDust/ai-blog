import { beforeEach, describe, expect, test, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany,
    },
  },
}));

describe("GET /api/posts/popular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns published posts ordered by view count", async () => {
    findMany.mockResolvedValueOnce([
      { id: "p1", title: "Popular", slug: "popular", viewCount: 128 },
    ]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/posts/popular"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{ id: "p1", title: "Popular", slug: "popular", viewCount: 128 }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { published: true, deletedAt: null, viewCount: { gt: 0 } },
      select: { id: true, title: true, slug: true, viewCount: true },
      orderBy: { viewCount: "desc" },
      take: 3,
    });
  });
});
