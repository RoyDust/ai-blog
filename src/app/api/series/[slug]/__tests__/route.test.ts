import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirst = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    series: {
      findFirst,
    },
  },
}));

describe("GET /api/series/[slug]", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  test("returns a public series with narrow select omitting content/internal fields and mapping soft-deleted category to null", async () => {
    findFirst.mockResolvedValueOnce({
      id: "s1",
      title: "Series",
      slug: "series",
      description: "Series intro",
      coverImage: null,
      deletedAt: null,
      posts: [
        {
          id: "p1",
          title: "First",
          slug: "first",
          content: "Full markdown content should never leak",
          summaryError: "internal error",
          summaryJobId: "job-1",
          deletedAt: null,
          browserId: "browser-1",
          excerpt: "Excerpt 1",
          coverImage: null,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          publishedAt: new Date("2026-04-01T00:00:00.000Z"),
          seriesOrder: 1,
          viewCount: 12,
          readingTimeMinutes: 5,
          author: { id: "u1", name: "Ada", image: null },
          category: { id: "c1", name: "Deleted Cat", slug: "deleted-cat", deletedAt: new Date("2026-04-02T00:00:00.000Z") },
          tags: [
            { id: "t1", name: "Prisma", slug: "prisma" },
            { id: "t2", name: "Removed", slug: "removed", deletedAt: new Date("2026-04-02T00:00:00.000Z") },
          ],
          _count: { comments: 2, likes: 4 },
        },
        {
          id: "p2",
          title: "Second",
          slug: "second",
          excerpt: null,
          coverImage: null,
          createdAt: new Date("2026-04-03T00:00:00.000Z"),
          publishedAt: new Date("2026-04-03T00:00:00.000Z"),
          seriesOrder: 2,
          viewCount: 8,
          readingTimeMinutes: 3,
          author: { id: "u1", name: "Ada", image: null },
          category: { id: "c2", name: "Active Cat", slug: "active-cat", deletedAt: null },
          tags: [],
          _count: { comments: 0, likes: 1 },
        },
      ],
      _count: { posts: 2 },
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/series/series"), {
      params: Promise.resolve({ slug: "series" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.posts).toHaveLength(2);

    const queryArgs = findFirst.mock.calls[0]?.[0];
    expect(queryArgs.include).toBeUndefined();
    expect(queryArgs.select).toBeDefined();
    expect(queryArgs.select).not.toHaveProperty("deletedAt");
    expect(queryArgs.select.posts.include).toBeUndefined();
    expect(queryArgs.select.posts.select).not.toHaveProperty("content");
    expect(queryArgs.select.posts.select).not.toHaveProperty("summaryError");
    expect(queryArgs.select.posts.select).not.toHaveProperty("summaryJobId");
    expect(queryArgs.select.posts.select).not.toHaveProperty("deletedAt");
    expect(queryArgs).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        slug: "series",
        deletedAt: null,
        posts: { some: { deletedAt: null, published: true } },
      }),
      select: expect.objectContaining({
        posts: expect.objectContaining({
          where: { deletedAt: null, published: true },
          select: expect.objectContaining({
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImage: true,
            createdAt: true,
            publishedAt: true,
            seriesOrder: true,
            viewCount: true,
            readingTimeMinutes: true,
            author: { select: { id: true, name: true, image: true } },
            category: { select: { id: true, name: true, slug: true, deletedAt: true } },
            tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
            _count: {
              select: {
                comments: { where: { deletedAt: null, status: "APPROVED" } },
                likes: true,
              },
            },
          }),
          orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        }),
      }),
    }));

    expect(payload.data).not.toHaveProperty("deletedAt");
    expect(payload.data.posts[0]).not.toHaveProperty("content");
    expect(payload.data.posts[0]).not.toHaveProperty("summaryError");
    expect(payload.data.posts[0]).not.toHaveProperty("summaryJobId");
    expect(payload.data.posts[0]).not.toHaveProperty("deletedAt");
    expect(payload.data.posts[0]).not.toHaveProperty("browserId");
    expect(payload.data.posts[0].category).toBeNull();
    expect(payload.data.posts[0].tags).toEqual([{ id: "t1", name: "Prisma", slug: "prisma" }]);
    expect(payload.data.posts[1].category).toEqual({ id: "c2", name: "Active Cat", slug: "active-cat" });
  });

  test("returns 404 when the series is deleted or has no published posts", async () => {
    findFirst.mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/series/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Series not found" });
  });
});
