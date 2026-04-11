import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirstCategory = vi.fn();
const findManyTags = vi.fn();
const findUniqueBinding = vi.fn();
const createBinding = vi.fn();
const createPost = vi.fn();
const updatePost = vi.fn();
const calculateReadingTimeMinutes = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: {
      findFirst: findFirstCategory,
    },
    tag: {
      findMany: findManyTags,
    },
    aiDraftBinding: {
      findUnique: findUniqueBinding,
      create: createBinding,
    },
    post: {
      create: createPost,
      update: updatePost,
    },
  },
}));

vi.mock("@/lib/reading-time", () => ({
  calculateReadingTimeMinutes,
}));

describe("ai authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates a new unpublished draft for a fresh external id", async () => {
    findFirstCategory.mockResolvedValueOnce({ id: "cat-1", slug: "engineering" });
    findManyTags.mockResolvedValueOnce([{ id: "tag-1", slug: "nextjs" }]);
    findUniqueBinding.mockResolvedValueOnce(null);
    calculateReadingTimeMinutes.mockReturnValueOnce(4);
    createPost.mockResolvedValueOnce({
      id: "post-1",
      title: "AI Writing",
      slug: "ai-writing",
      content: "# Hello",
      excerpt: "summary",
      coverImage: null,
      readingTimeMinutes: 4,
      published: false,
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });
    createBinding.mockResolvedValueOnce({});

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-001",
        title: "AI Writing",
        slug: "ai-writing",
        content: "# Hello",
        excerpt: "summary",
        categorySlug: "engineering",
        tagSlugs: ["nextjs"],
      },
    });

    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        authorId: "user-1",
        published: false,
        publishedAt: null,
        readingTimeMinutes: 4,
        categoryId: "cat-1",
      }),
    }));
    expect(result.operation).toBe("created");
    expect(result.draft.externalId).toBe("draft-001");
  });

  test("updates the existing draft when the client reuses external id", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding.mockResolvedValueOnce({
      clientId: "client-1",
      externalId: "draft-001",
      postId: "post-1",
    });
    calculateReadingTimeMinutes.mockReturnValueOnce(6);
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      title: "Updated",
      slug: "updated",
      content: "# Updated",
      excerpt: null,
      coverImage: null,
      readingTimeMinutes: 6,
      published: false,
      category: null,
      tags: [],
    });

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-001",
        title: "Updated",
        slug: "updated",
        content: "# Updated",
      },
    });

    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1" },
      data: expect.objectContaining({
        published: false,
        publishedAt: null,
      }),
    }));
    expect(result.operation).toBe("updated");
  });
});
