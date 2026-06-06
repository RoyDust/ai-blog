import { beforeEach, describe, expect, test, vi } from "vitest";

const create = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const deleteMany = vi.fn();
const createMany = vi.fn();
const postFindMany = vi.fn();
const transaction = vi.fn();

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

  test("creates a draft guide with ordered post ids", async () => {
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
  });

  test("rejects guide posts that do not exist before creating links", async () => {
    postFindMany.mockResolvedValueOnce([{ id: "post-1" }]);

    const { createTopicGuide } = await import("../topic-guides");

    await expect(createTopicGuide({
      title: "React Guide",
      postIds: ["post-1", "missing-post"],
    })).rejects.toThrow("Topic guide post not found: missing-post");
    expect(create).not.toHaveBeenCalled();
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

  test("public listing degrades to empty when topic guide storage is missing", async () => {
    findMany.mockRejectedValueOnce({
      code: "P2021",
      message: "The table `public.topic_guides` does not exist in the current database.",
    });

    const { listPublicTopicGuides } = await import("../topic-guides");
    await expect(listPublicTopicGuides()).resolves.toEqual([]);
  });

  test("public guide lookup filters drafts, deleted guides, and non-public posts", async () => {
    findFirst.mockResolvedValueOnce({ id: "guide-1", posts: [] });

    const { getPublicTopicGuideBySlug } = await import("../topic-guides");
    const guide = await getPublicTopicGuideBySlug("react-guide");

    expect(guide).toEqual({ id: "guide-1", posts: [] });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "react-guide", status: "published", deletedAt: null },
      include: expect.objectContaining({
        posts: expect.objectContaining({
          where: { post: { published: true, deletedAt: null } },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        }),
      }),
    }));
  });

  test("public guide lookup returns null when topic guide storage is missing", async () => {
    findFirst.mockRejectedValueOnce({
      code: "P2021",
      message: "The table `public.topic_guides` does not exist in the current database.",
    });

    const { getPublicTopicGuideBySlug } = await import("../topic-guides");
    await expect(getPublicTopicGuideBySlug("react-guide")).resolves.toBeNull();
  });

  test("updates guide posts in stable order when replacing the curation list", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "guide-1",
        title: "Guide",
        slug: "guide",
        description: null,
        status: "draft",
      })
      .mockResolvedValueOnce({ id: "guide-1", posts: [] });

    const { updateTopicGuide } = await import("../topic-guides");
    await updateTopicGuide("guide-1", {
      title: "Guide",
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
  });
});
