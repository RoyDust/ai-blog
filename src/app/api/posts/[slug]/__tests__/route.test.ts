import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst,
      update,
    },
  },
}));

describe("/api/posts/[slug] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("only exposes public GET and removes legacy PATCH/DELETE write handlers", async () => {
    const routeModule = await import("../route");

    expect(typeof routeModule.GET).toBe("function");
    expect("POST" in routeModule).toBe(false);
    expect("PATCH" in routeModule).toBe(false);
    expect("PUT" in routeModule).toBe(false);
    expect("DELETE" in routeModule).toBe(false);
  });

  test("uses an explicit safe public select without leaking browserId or internal AI/scheduling fields", async () => {
    findFirst.mockResolvedValueOnce({
      id: "post-1",
      slug: "hello",
      title: "Hello",
      content: "Body",
      excerpt: "Excerpt",
      seoTitle: null,
      seoDescription: null,
      coverImage: null,
      published: true,
      featured: false,
      viewCount: 10,
      readingTimeMinutes: 3,
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      updatedAt: new Date("2026-05-01T00:00:00.000Z"),
      publishedAt: new Date("2026-05-01T00:00:00.000Z"),
      author: { id: "author-1", name: "Author", image: null },
      category: { id: "cat-1", name: "Tech", slug: "tech", description: null },
      tags: [{ id: "tag-1", name: "AI", slug: "ai", color: null }],
      series: null,
      comments: [
        {
          id: "comment-1",
          content: "Great post",
          authorLabel: "203.0.*.*",
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          author: null,
          replies: [],
        },
      ],
      _count: { comments: 1, likes: 2 },
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/posts/hello"), {
      params: Promise.resolve({ slug: "hello" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledTimes(1);

    const queryArg = findFirst.mock.calls[0]?.[0] as {
      where?: Record<string, unknown>;
      include?: unknown;
      select?: Record<string, unknown>;
    };

    expect(queryArg.where).toEqual({ slug: "hello", deletedAt: null, published: true });
    expect(queryArg.include).toBeUndefined();
    expect(queryArg.select).toBeDefined();

    // Post-level sensitive/internal columns must never be selected
    for (const forbiddenField of [
      "authorId",
      "browserId",
      "summaryStatus",
      "summaryError",
      "summaryGeneratedAt",
      "summaryJobId",
      "summaryModelId",
      "seoGeneratedAt",
      "seoModelId",
      "coverAssetId",
      "scheduledAt",
      "deletedAt",
    ]) {
      expect(queryArg.select).not.toHaveProperty(forbiddenField);
      expect(payload.data).not.toHaveProperty(forbiddenField);
    }

    const commentSelect = (
      queryArg.select?.comments as {
        select?: Record<string, unknown>;
      }
    )?.select;
    expect(commentSelect).toMatchObject({
      id: true,
      content: true,
      authorLabel: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    });
    expect(commentSelect).not.toHaveProperty("browserId");
    expect(commentSelect).not.toHaveProperty("authorId");

    const replySelect = (
      commentSelect?.replies as {
        select?: Record<string, unknown>;
      }
    )?.select;
    expect(replySelect).toMatchObject({
      id: true,
      content: true,
      authorLabel: true,
      createdAt: true,
      author: { select: { id: true, name: true, image: true } },
    });
    expect(replySelect).not.toHaveProperty("browserId");
    expect(replySelect).not.toHaveProperty("authorId");

    expect(queryArg.select?._count).toEqual({
      select: {
        comments: { where: { deletedAt: null, status: "APPROVED" } },
        likes: true,
      },
    });

    // 浏览量只由 analytics 信标累加，详情 GET 必须是纯读。
    expect(update).not.toHaveBeenCalled();
  });

  test("returns 404 when post is missing or unpublished", async () => {
    findFirst.mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/posts/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: "Post not found" });
  });
});
