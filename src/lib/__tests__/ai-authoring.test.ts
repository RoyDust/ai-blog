import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirstCategory = vi.fn();
const findManyTags = vi.fn();
const findUniqueBinding = vi.fn();
const findFirstBinding = vi.fn();
const createBinding = vi.fn();
const updateBinding = vi.fn();
const createPost = vi.fn();
const updatePost = vi.fn();
const findUniquePost = vi.fn();
const findFirstPost = vi.fn();
const calculateReadingTimeMinutes = vi.fn();
const revalidatePublicContent = vi.fn();
const resolvePostCoverInput = vi.fn();
const touchCoverAssetUsage = vi.fn();

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
      findFirst: findFirstBinding,
      create: createBinding,
      update: updateBinding,
    },
    post: {
      create: createPost,
      update: updatePost,
      findUnique: findUniquePost,
      findFirst: findFirstPost,
    },
    $transaction: vi.fn(async (callback) => callback({
      post: {
        create: createPost,
        update: updatePost,
        findUnique: findUniquePost,
      },
      aiDraftBinding: {
        create: createBinding,
        update: updateBinding,
      },
    })),
  },
}));

vi.mock("@/lib/reading-time", () => ({
  calculateReadingTimeMinutes,
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}));

vi.mock("@/lib/cover-assets", () => ({
  resolvePostCoverInput,
  touchCoverAssetUsage,
}));

describe("ai authoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePostCoverInput.mockResolvedValue({
      coverImage: undefined,
      coverAssetId: undefined,
      selectedAssetId: null,
    });
    touchCoverAssetUsage.mockResolvedValue(undefined);
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
      post: {
        id: "post-1",
        deletedAt: null,
        published: false,
        slug: "draft-001",
        category: null,
        tags: [],
      },
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
      where: expect.objectContaining({ id: "post-1", published: false }),
      data: expect.objectContaining({
        published: false,
        publishedAt: null,
      }),
    }));
    expect(result.operation).toBe("updated");
  });

  test("rejects unknown categorySlug", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);

    const { upsertAiDraft } = await import("../ai-authoring");
    await expect(upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-002",
        title: "AI Draft",
        slug: "ai-draft",
        content: "content",
        categorySlug: "unknown",
      },
    })).rejects.toMatchObject({ name: "ValidationError" });
  });

  test("rejects unknown tagSlugs", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);

    const { upsertAiDraft } = await import("../ai-authoring");
    await expect(upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-003",
        title: "AI Draft",
        slug: "ai-draft",
        content: "content",
        tagSlugs: ["unknown-tag"],
      },
    })).rejects.toMatchObject({ name: "ValidationError" });
  });

  test("does not return deleted drafts from getAiDraft", async () => {
    findFirstBinding.mockResolvedValueOnce(null);

    const { getAiDraft } = await import("../ai-authoring");
    const result = await getAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] },
      externalId: "draft-004",
    });

    expect(findFirstBinding).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        post: {
          deletedAt: null,
          published: false,
        },
      }),
    }));
    expect(result).toBeNull();
  });

  test("does not return published bindings from getAiDraft", async () => {
    findFirstBinding.mockResolvedValueOnce({
      externalId: "draft-005",
      post: {
        id: "post-1",
        title: "Published",
        slug: "published-post",
        content: "Live content",
        excerpt: null,
        coverImage: null,
        readingTimeMinutes: 5,
        published: true,
        category: null,
        tags: [],
      },
    });

    const { getAiDraft } = await import("../ai-authoring");
    const result = await getAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] },
      externalId: "draft-005",
    });

    expect(findFirstBinding).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        post: {
          deletedAt: null,
          published: false,
        },
      }),
    }));
    expect(result).toBeNull();
  });

  test("filters deleted taxonomy from getAiDraft readback", async () => {
    findFirstBinding.mockResolvedValueOnce({
      externalId: "draft-005b",
      post: {
        id: "post-1",
        title: "Draft with stale taxonomy",
        slug: "draft-with-stale-taxonomy",
        content: "Draft content",
        excerpt: null,
        coverImage: null,
        readingTimeMinutes: 5,
        published: false,
        category: {
          slug: "deleted-category",
          deletedAt: new Date("2026-01-01"),
        },
        tags: [
          { slug: "active-tag", deletedAt: null },
          { slug: "deleted-tag", deletedAt: new Date("2026-01-01") },
        ],
      },
    });

    const { getAiDraft } = await import("../ai-authoring");
    const result = await getAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:read"] },
      externalId: "draft-005b",
    });

    expect(result).toMatchObject({
      externalId: "draft-005b",
      categorySlug: null,
      tagSlugs: ["active-tag"],
    });
  });

  test("rejects writes when the binding points to a published post", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding.mockResolvedValueOnce({
      clientId: "client-1",
      externalId: "draft-006",
      postId: "post-1",
      post: {
        id: "post-1",
        deletedAt: null,
        published: true,
        slug: "public-slug",
        category: { slug: "public-category" },
        tags: [{ slug: "public-tag" }],
      },
    });

    const { upsertAiDraft } = await import("../ai-authoring");
    await expect(upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-006",
        title: "Updated",
        slug: "updated",
        content: "Updated",
      },
    })).rejects.toMatchObject({ name: "ConflictError" });

    expect(updatePost).not.toHaveBeenCalled();
    expect(revalidatePublicContent).not.toHaveBeenCalled();
  });

  test("rejects writes when the post becomes published at update time", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding.mockResolvedValueOnce({
      clientId: "client-1",
      externalId: "draft-006b",
      postId: "post-1",
      post: {
        id: "post-1",
        deletedAt: null,
        published: false,
        slug: "draft-006b",
        category: null,
        tags: [],
      },
    });
    calculateReadingTimeMinutes.mockReturnValueOnce(5);
    updatePost.mockRejectedValueOnce({ code: "P2025" });
    findUniquePost.mockResolvedValueOnce({
      id: "post-1",
      deletedAt: null,
      published: true,
    });

    const { upsertAiDraft } = await import("../ai-authoring");
    await expect(upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-006b",
        title: "Updated",
        slug: "updated",
        content: "Updated",
      },
    })).rejects.toMatchObject({ name: "ConflictError" });

    expect(updatePost).toHaveBeenCalledTimes(1);
    expect(findUniquePost).toHaveBeenCalledWith({
      where: { id: "post-1" },
      select: {
        id: true,
        deletedAt: true,
        published: true,
      },
    });
  });

  test("falls back to update after prisma conflict during create", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        clientId: "client-1",
        externalId: "draft-007",
        postId: "post-1",
        post: {
          id: "post-1",
          deletedAt: null,
          published: false,
          slug: "draft-007",
          category: null,
          tags: [],
        },
      });
    calculateReadingTimeMinutes.mockReturnValueOnce(3);
    createPost.mockResolvedValueOnce({
      id: "post-new",
      title: "AI Draft",
      slug: "ai-draft",
      content: "content",
      excerpt: null,
      coverImage: null,
      readingTimeMinutes: 3,
      published: false,
      category: null,
      tags: [],
    });
    createBinding.mockImplementationOnce(() => {
      throw { code: "P2002" };
    });
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      title: "AI Draft",
      slug: "ai-draft",
      content: "content",
      excerpt: null,
      coverImage: null,
      readingTimeMinutes: 3,
      published: false,
      category: null,
      tags: [],
    });

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-007",
        title: "AI Draft",
        slug: "ai-draft",
        content: "content",
      },
    });

    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "post-1", published: false }),
    }));
    expect(result.operation).toBe("updated");
  });

  test("rebinds when existing draft post is deleted", async () => {
    findFirstCategory.mockResolvedValueOnce(null);
    findManyTags.mockResolvedValueOnce([]);
    findUniqueBinding.mockResolvedValueOnce({
      clientId: "client-1",
      externalId: "draft-008",
      postId: "post-old",
      post: {
        id: "post-old",
        deletedAt: new Date("2026-01-01"),
        published: false,
        slug: "old-draft",
        category: null,
        tags: [],
      },
    });
    calculateReadingTimeMinutes.mockReturnValueOnce(2);
    createPost.mockResolvedValueOnce({
      id: "post-new",
      title: "AI Draft",
      slug: "ai-draft",
      content: "content",
      excerpt: null,
      coverImage: null,
      readingTimeMinutes: 2,
      published: false,
      category: null,
      tags: [],
    });
    updateBinding.mockResolvedValueOnce({});

    const { upsertAiDraft } = await import("../ai-authoring");
    const result = await upsertAiDraft({
      client: { id: "client-1", ownerId: "user-1", name: "Codex", scopes: ["drafts:write"] },
      input: {
        externalId: "draft-008",
        title: "AI Draft",
        slug: "ai-draft",
        content: "content",
      },
    });

    expect(updateBinding).toHaveBeenCalledWith(expect.objectContaining({
      data: { postId: "post-new" },
    }));
    expect(result.operation).toBe("created");
  });

  test("updateAdminPost writes featured and returns it in the response payload", async () => {
    findFirstPost.mockResolvedValueOnce({
      slug: "old-slug",
      coverImage: "https://cdn.example.com/existing.jpg",
      category: { slug: "old-category" },
      tags: [{ slug: "legacy-tag" }],
    });
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      slug: "new-slug",
      published: true,
      featured: true,
      readingTimeMinutes: 8,
      category: { slug: "new-category" },
      tags: [{ slug: "fresh-tag" }],
    });

    calculateReadingTimeMinutes.mockReturnValueOnce(8);

    const { updateAdminPost } = await import("../ai-authoring");
    const result = await updateAdminPost({
      id: "post-1",
      input: {
        title: "Updated",
        slug: "new-slug",
        content: "updated content",
        featured: true,
        published: true,
      },
    });

    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        featured: true,
      }),
      select: expect.objectContaining({
        featured: true,
      }),
    }));
    expect(result).toMatchObject({ featured: true });
  });

  test("createAdminPost resolves cover assets before writing a post", async () => {
    resolvePostCoverInput.mockResolvedValueOnce({
      coverImage: "https://cdn.example.com/covers/a.jpg",
      coverAssetId: "cover-1",
      selectedAssetId: "cover-1",
    });
    calculateReadingTimeMinutes.mockReturnValueOnce(3);
    createPost.mockResolvedValueOnce({
      id: "post-1",
      slug: "new-post",
      published: false,
      readingTimeMinutes: 3,
      category: null,
      tags: [],
    });

    const { createAdminPost } = await import("../ai-authoring");
    await createAdminPost({
      authorId: "admin-1",
      input: {
        title: "New Post",
        slug: "new-post",
        content: "content",
        coverAssetId: "cover-1",
        published: false,
      },
    });

    expect(resolvePostCoverInput).toHaveBeenCalledWith({
      coverImage: undefined,
      coverAssetId: "cover-1",
      allowRandom: false,
    });
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        coverImage: "https://cdn.example.com/covers/a.jpg",
        coverAssetId: "cover-1",
      }),
    }));
    expect(touchCoverAssetUsage).toHaveBeenCalledWith("cover-1");
  });
});
