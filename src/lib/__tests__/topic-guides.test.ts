import { beforeEach, describe, expect, test, vi } from "vitest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
});

const create = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const deleteMany = vi.fn();
const createMany = vi.fn();
const postFindMany = vi.fn();
const transaction = vi.fn();
const revalidateTopicGuides = vi.fn();

vi.mock("@/lib/cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cache")>();
  return {
    ...actual,
    revalidateTopicGuides,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    topicGuide: {
      create,
      findMany,
      findFirst,
      update,
    },
    topicGuidePost: {
      deleteMany,
      createMany,
    },
    post: {
      findMany: postFindMany,
    },
  },
}));

describe("topic guide service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockResolvedValue([]);
    postFindMany.mockResolvedValue([{ id: "post-1" }, { id: "post-2" }]);
  });

  test("creates a draft guide with ordered post ids and revalidates guide paths", async () => {
    create.mockResolvedValueOnce({ id: "guide-1", title: "React Guide", slug: "react-guide" });

    const { createTopicGuide } = await import("../topic-guides");
    const guide = await createTopicGuide({
      title: "React Guide",
      description: "Start here",
      postIds: ["post-1", "post-2", "post-1"],
    });

    expect(guide).toEqual({ id: "guide-1", title: "React Guide", slug: "react-guide" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        title: "React Guide",
        slug: "react-guide",
        description: "Start here",
        status: "draft",
        posts: {
          create: [
            { postId: "post-1", order: 1, note: null },
            { postId: "post-2", order: 2, note: null },
          ],
        },
      },
    }));
    expect(revalidateTopicGuides).toHaveBeenCalledWith({ slug: "react-guide" });
  });

  test("rejects guide posts that do not exist before creating links", async () => {
    postFindMany.mockResolvedValueOnce([{ id: "post-1" }]);

    const { createTopicGuide } = await import("../topic-guides");

    await expect(createTopicGuide({
      title: "React Guide",
      postIds: ["post-1", "missing-post"],
    })).rejects.toThrow("Topic guide post not found: missing-post");
    expect(create).not.toHaveBeenCalled();
    expect(revalidateTopicGuides).not.toHaveBeenCalled();
  });

  test("public listing only returns published and non-deleted guides with public posts", async () => {
    findMany.mockResolvedValueOnce([{ id: "guide-1", title: "Published", posts: [{ id: "row-1" }] }]);

    const { listPublicTopicGuides } = await import("../topic-guides");
    const guides = await listPublicTopicGuides();

    expect(guides).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        status: "published",
        deletedAt: null,
        posts: {
          some: {
            post: { published: true, deletedAt: null },
          },
        },
      },
    }));
  });

  test("public listing degrades to empty without caching when topic guide storage is missing", async () => {
    const setSpy = vi.fn();
    const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown };
    const previousCache = globalWithCache.__incrementalCache;
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async () => null,
      set: setSpy,
    };

    try {
      findMany.mockRejectedValueOnce({
        code: "P2021",
        message: "The table `public.topic_guides` does not exist in the current database.",
      });

      const { listPublicTopicGuides } = await import("../topic-guides");
      await expect(listPublicTopicGuides()).resolves.toEqual([]);
      expect(setSpy).not.toHaveBeenCalled();
    } finally {
      if (previousCache === undefined) {
        delete globalWithCache.__incrementalCache;
      } else {
        globalWithCache.__incrementalCache = previousCache;
      }
    }
  });

  test("public guide lookup filters drafts/deleted guides and uses narrow Post select omitting content and soft-deleted categories", async () => {
    findFirst.mockResolvedValueOnce({
      id: "guide-1",
      posts: [
        {
          id: "gp-1",
          order: 1,
          post: {
            id: "post-1",
            title: "Guide Post",
            slug: "guide-post",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            category: {
              id: "cat-deleted",
              name: "Deleted",
              slug: "deleted",
              deletedAt: new Date("2026-04-02T00:00:00.000Z"),
            },
            tags: [],
          },
        },
      ],
    });

    const { getPublicTopicGuideBySlug } = await import("../topic-guides");
    const guide = await getPublicTopicGuideBySlug("react-guide");

    expect(guide?.posts[0]?.post.category).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "react-guide", status: "published", deletedAt: null },
      include: expect.objectContaining({
        posts: expect.objectContaining({
          where: { post: { published: true, deletedAt: null } },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        }),
      }),
    }));

    const queryArgs = findFirst.mock.calls[0]?.[0];
    const postRelation = queryArgs?.include?.posts?.include?.post;
    expect(postRelation?.select).toBeDefined();
    expect(postRelation?.include).toBeUndefined();
    expect(postRelation?.select).not.toHaveProperty("content");
    expect(postRelation?.select).toMatchObject({
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      readingTimeMinutes: true,
      viewCount: true,
      category: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      },
    });
  });

  test("public guide lookup returns null when topic guide storage is missing", async () => {
    findFirst.mockRejectedValueOnce({
      code: "P2021",
      message: "The table `public.topic_guides` does not exist in the current database.",
    });

    const { getPublicTopicGuideBySlug } = await import("../topic-guides");
    await expect(getPublicTopicGuideBySlug("react-guide")).resolves.toBeNull();
  });

  test("updates guide posts in stable order and revalidates both old and new slugs", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "guide-1",
        title: "Guide",
        slug: "old-guide",
        description: null,
        status: "draft",
      })
      .mockResolvedValueOnce({ id: "guide-1", slug: "new-guide", posts: [] });

    const { updateTopicGuide } = await import("../topic-guides");
    await updateTopicGuide("guide-1", {
      title: "Guide",
      slug: "new-guide",
      posts: [
        { postId: "post-2", note: "Second" },
        { postId: "post-1", note: "First" },
      ],
    });

    expect(deleteMany).toHaveBeenCalledWith({ where: { guideId: "guide-1" } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { guideId: "guide-1", postId: "post-2", order: 1, note: "Second" },
        { guideId: "guide-1", postId: "post-1", order: 2, note: "First" },
      ],
    });
    expect(revalidateTopicGuides).toHaveBeenCalledWith({
      slug: "new-guide",
      previousSlug: "old-guide",
    });
  });

  test("soft deletes guide and revalidates previous guide slug", async () => {
    findFirst.mockResolvedValueOnce({ id: "guide-1", slug: "react-guide" });
    update.mockResolvedValueOnce({ id: "guide-1", slug: "react-guide", deletedAt: new Date() });

    const { softDeleteTopicGuide } = await import("../topic-guides");
    await softDeleteTopicGuide("guide-1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "guide-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidateTopicGuides).toHaveBeenCalledWith({
      previousSlug: "react-guide",
    });
  });

  test("rejects missing posts before replacing guide curation links", async () => {
    findFirst.mockResolvedValueOnce({
      id: "guide-1",
      title: "Guide",
      slug: "guide",
      description: null,
      status: "draft",
    });
    postFindMany.mockResolvedValueOnce([{ id: "post-1" }]);

    const { updateTopicGuide } = await import("../topic-guides");

    await expect(updateTopicGuide("guide-1", {
      posts: [
        { postId: "post-1" },
        { postId: "missing-post" },
      ],
    })).rejects.toThrow("Topic guide post not found: missing-post");
    expect(transaction).not.toHaveBeenCalled();
    expect(revalidateTopicGuides).not.toHaveBeenCalled();
  });
});
