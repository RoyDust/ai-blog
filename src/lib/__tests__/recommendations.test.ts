import { beforeEach, describe, expect, test, vi } from "vitest";

const postFindFirst = vi.fn();
const postFindMany = vi.fn();
const readingEventFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: postFindFirst,
      findMany: postFindMany,
    },
    readingEvent: {
      findMany: readingEventFindMany,
    },
  },
}));

describe("recommendation scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("prioritizes tag overlap, same category, same series, and engagement", async () => {
    const { scoreRecommendationCandidate } = await import("../recommendations");
    const score = scoreRecommendationCandidate({
      current: { id: "post-1", categoryId: "cat-1", seriesId: "series-1", tagIds: ["tag-a", "tag-b"] },
      candidate: {
        id: "post-2",
        categoryId: "cat-1",
        seriesId: "series-1",
        tagIds: ["tag-a"],
        viewCount: 100,
        likeCount: 5,
        publishedAt: new Date("2026-06-01T00:00:00Z"),
      },
      now: new Date("2026-06-03T00:00:00Z"),
    });

    expect(score).toBeGreaterThan(20);
  });

  test("returns negative infinity for the current post", async () => {
    const { scoreRecommendationCandidate } = await import("../recommendations");

    expect(scoreRecommendationCandidate({
      current: { id: "post-1", categoryId: null, seriesId: null, tagIds: [] },
      candidate: {
        id: "post-1",
        categoryId: null,
        seriesId: null,
        tagIds: [],
        viewCount: 999,
        likeCount: 99,
      },
    })).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("getRecommendedPostsForPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readingEventFindMany.mockResolvedValue([]);
  });

  test("excludes current post and ranks by deterministic article signals", async () => {
    postFindFirst.mockResolvedValueOnce({
      id: "post-1",
      categoryId: "cat-1",
      seriesId: "series-1",
      tags: [{ id: "tag-a" }, { id: "tag-b" }],
    });
    postFindMany.mockResolvedValueOnce([
      recommendationCandidate({
        id: "post-low",
        categoryId: "cat-2",
        seriesId: null,
        tags: [{ id: "tag-z", name: "Other", slug: "other" }],
        viewCount: 600,
        likes: 20,
      }),
      recommendationCandidate({
        id: "post-high",
        categoryId: "cat-1",
        seriesId: "series-1",
        tags: [{ id: "tag-a", name: "React", slug: "react" }],
        viewCount: 50,
        likes: 1,
      }),
    ]);

    const { getRecommendedPostsForPost } = await import("../recommendations");
    const posts = await getRecommendedPostsForPost({
      postId: "post-1",
      limit: 1,
      now: new Date("2026-06-03T00:00:00Z"),
    });

    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe("post-high");
    expect(postFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1", deletedAt: null, published: true },
    }));
    expect(postFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { not: "post-1" },
        deletedAt: null,
        published: true,
      },
      select: expect.objectContaining({
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        createdAt: true,
        category: { select: { name: true, slug: true } },
      }),
    }));
  });

  test("falls back to popular and recent candidates when there is no tag overlap", async () => {
    postFindFirst.mockResolvedValueOnce({
      id: "post-1",
      categoryId: null,
      seriesId: null,
      tags: [],
    });
    postFindMany.mockResolvedValueOnce([
      recommendationCandidate({
        id: "recent",
        viewCount: 10,
        likes: 0,
        publishedAt: new Date("2026-06-02T00:00:00Z"),
      }),
      recommendationCandidate({
        id: "popular",
        viewCount: 1_000,
        likes: 30,
        publishedAt: new Date("2026-05-20T00:00:00Z"),
      }),
    ]);

    const { getRecommendedPostsForPost } = await import("../recommendations");
    const posts = await getRecommendedPostsForPost({
      postId: "post-1",
      limit: 2,
      now: new Date("2026-06-03T00:00:00Z"),
    });

    expect(posts.map((post) => post.id)).toEqual(["popular", "recent"]);
  });

  test("optionally excludes posts already read by the user", async () => {
    postFindFirst.mockResolvedValueOnce({
      id: "post-1",
      categoryId: null,
      seriesId: null,
      tags: [],
    });
    readingEventFindMany.mockResolvedValueOnce([{ postId: "read-post" }]);
    postFindMany.mockResolvedValueOnce([
      recommendationCandidate({ id: "unread-post" }),
    ]);

    const { getRecommendedPostsForPost } = await import("../recommendations");
    const posts = await getRecommendedPostsForPost({
      postId: "post-1",
      userId: "user-1",
      excludeRead: true,
    });

    expect(posts.map((post) => post.id)).toEqual(["unread-post"]);
    expect(readingEventFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", postId: { not: "post-1" } },
      select: { postId: true },
      distinct: ["postId"],
      take: 200,
    });
    expect(postFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: "post-1", notIn: ["read-post"] },
      }),
    }));
  });

  test("returns an empty list when the current post is unavailable publicly", async () => {
    postFindFirst.mockResolvedValueOnce(null);

    const { getRecommendedPostsForPost } = await import("../recommendations");

    await expect(getRecommendedPostsForPost({ postId: "missing" })).resolves.toEqual([]);
    expect(postFindMany).not.toHaveBeenCalled();
  });
});

function recommendationCandidate(overrides: {
  id: string;
  categoryId?: string | null;
  seriesId?: string | null;
  tags?: Array<{ id: string; name: string; slug: string }>;
  viewCount?: number;
  likes?: number;
  publishedAt?: Date;
}) {
  return {
    id: overrides.id,
    title: overrides.id,
    slug: overrides.id,
    excerpt: `${overrides.id} excerpt`,
    coverImage: null,
    createdAt: overrides.publishedAt ?? new Date("2026-06-01T00:00:00Z"),
    publishedAt: overrides.publishedAt ?? new Date("2026-06-01T00:00:00Z"),
    categoryId: overrides.categoryId ?? null,
    seriesId: overrides.seriesId ?? null,
    viewCount: overrides.viewCount ?? 0,
    category: overrides.categoryId ? { name: "Category", slug: "category" } : null,
    tags: overrides.tags ?? [],
    _count: { likes: overrides.likes ?? 0 },
  };
}
