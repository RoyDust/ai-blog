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

  test("returns a public series with only published posts in series order", async () => {
    findFirst.mockResolvedValueOnce({
      id: "s1",
      title: "Series",
      slug: "series",
      posts: [{ id: "p1", title: "First", slug: "first" }],
      _count: { posts: 1 },
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/series/series"), {
      params: Promise.resolve({ slug: "series" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.posts).toHaveLength(1);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "series",
        deletedAt: null,
        posts: { some: { deletedAt: null, published: true } },
      }),
      include: expect.objectContaining({
        posts: expect.objectContaining({
          where: { deletedAt: null, published: true },
          include: expect.objectContaining({
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
