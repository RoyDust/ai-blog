import { beforeEach, describe, expect, test, vi } from "vitest";

const findManyCoverAssets = vi.fn();
const countCoverAssets = vi.fn();
const findFirstCoverAsset = vi.fn();
const findUniqueCoverAsset = vi.fn();
const createCoverAssetRecord = vi.fn();
const updateCoverAssetRecord = vi.fn();
const findManyPosts = vi.fn();
const updatePost = vi.fn();
const revalidatePublicContent = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverAsset: {
      findMany: findManyCoverAssets,
      count: countCoverAssets,
      findFirst: findFirstCoverAsset,
      findUnique: findUniqueCoverAsset,
      create: createCoverAssetRecord,
      update: updateCoverAssetRecord,
    },
    post: {
      findMany: findManyPosts,
      update: updatePost,
    },
    $transaction: vi.fn(async (callback) => callback({
      post: {
        update: updatePost,
      },
      coverAsset: {
        update: updateCoverAssetRecord,
      },
    })),
  },
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}));

describe("cover asset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QINIU_DOMAIN = "https://cdn.example.com";
  });

  test("returns existing record when creating a duplicate cover URL", async () => {
    const existing = {
      id: "cover-1",
      url: "https://cdn.example.com/covers/a.jpg",
      deletedAt: null,
    };
    findUniqueCoverAsset.mockResolvedValueOnce(existing);

    const { createCoverAsset } = await import("../cover-assets");
    const result = await createCoverAsset({
      url: "https://cdn.example.com/covers/a.jpg",
      key: "covers/a.jpg",
      provider: "qiniu",
      source: "upload",
      status: "active",
      tags: [],
    });

    expect(result).toBe(existing);
    expect(createCoverAssetRecord).not.toHaveBeenCalled();
  });

  test("rejects qiniu assets from a different host", async () => {
    const { createCoverAsset } = await import("../cover-assets");

    await expect(createCoverAsset({
      url: "https://other.example.com/covers/a.jpg",
      key: "covers/a.jpg",
      provider: "qiniu",
      source: "upload",
      status: "active",
      tags: [],
    })).rejects.toMatchObject({ name: "ValidationError" });
  });

  test("marks AI source covers as AI-generated on create", async () => {
    findUniqueCoverAsset.mockResolvedValueOnce(null);
    createCoverAssetRecord.mockResolvedValueOnce({ id: "cover-ai" });

    const { createCoverAsset } = await import("../cover-assets");
    await createCoverAsset({
      url: "https://cdn.example.com/covers/ai/a.jpg",
      key: "covers/ai/a.jpg",
      provider: "qiniu",
      source: "ai",
      status: "active",
      tags: [],
    });

    expect(createCoverAssetRecord).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        source: "ai",
        generatedByAi: true,
      }),
    }));
  });

  test("selects a deterministic random active cover", async () => {
    countCoverAssets.mockResolvedValueOnce(5);
    findFirstCoverAsset.mockResolvedValueOnce({ id: "cover-3" });

    const { selectRandomCoverAsset } = await import("../cover-assets");
    const result = await selectRandomCoverAsset({ random: () => 0.42 });

    expect(findFirstCoverAsset).toHaveBeenCalledWith(expect.objectContaining({
      skip: 2,
      where: {
        status: "active",
        source: "upload",
        generatedByAi: false,
        deletedAt: null,
      },
    }));
    expect(result).toEqual({ id: "cover-3" });
  });

  test("returns null when there are no active covers", async () => {
    countCoverAssets.mockResolvedValueOnce(0);

    const { selectRandomCoverAsset } = await import("../cover-assets");
    await expect(selectRandomCoverAsset()).resolves.toBeNull();
    expect(findFirstCoverAsset).not.toHaveBeenCalled();
  });

  test("applies a cover asset to a post and increments usage", async () => {
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      slug: "post-1",
      published: true,
      category: { slug: "notes" },
      tags: [{ slug: "nextjs" }],
    });
    updateCoverAssetRecord.mockResolvedValueOnce({});

    const { applyCoverAssetToPost } = await import("../cover-assets");
    await applyCoverAssetToPost("post-1", {
      id: "cover-1",
      url: "https://cdn.example.com/covers/a.jpg",
      key: "covers/a.jpg",
      provider: "qiniu",
      source: "upload",
      generatedByAi: false,
      status: "active",
      title: null,
      alt: null,
      description: null,
      tags: [],
      usageCount: 0,
      lastUsedAt: null,
      createdAt: new Date("2026-04-26"),
    });

    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        coverImage: "https://cdn.example.com/covers/a.jpg",
        coverAssetId: "cover-1",
      },
    }));
    expect(updateCoverAssetRecord).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        usageCount: { increment: 1 },
      }),
    }));
    expect(revalidatePublicContent).toHaveBeenCalledWith({
      slug: "post-1",
      categorySlug: "notes",
      tagSlugs: ["nextjs"],
    });
  });

  test("backfills only missing-cover posts and reports empty gallery", async () => {
    findManyPosts.mockResolvedValueOnce([{ id: "post-1" }, { id: "post-2" }]);
    countCoverAssets.mockResolvedValueOnce(0);

    const { backfillMissingPostCovers } = await import("../cover-assets");
    const result = await backfillMissingPostCovers({ publishedOnly: true });

    expect(findManyPosts).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        published: true,
        generatedByAiNews: false,
        OR: [{ coverImage: null }, { coverImage: "" }],
      }),
    }));
    expect(result).toEqual({
      updated: 0,
      skipped: 2,
      skippedReason: "NO_ACTIVE_COVERS",
    });
  });

  test("can replace all non AI daily post covers with uploaded library assets", async () => {
    findManyPosts.mockResolvedValueOnce([{ id: "post-1" }]);
    countCoverAssets.mockResolvedValueOnce(1);
    findFirstCoverAsset.mockResolvedValueOnce({
      id: "cover-1",
      url: "https://cdn.example.com/covers/uploaded.jpg",
      key: "covers/uploaded.jpg",
      provider: "qiniu",
      source: "upload",
      generatedByAi: false,
      status: "active",
      title: null,
      alt: null,
      description: null,
      tags: [],
      usageCount: 0,
      lastUsedAt: null,
      createdAt: new Date("2026-06-06"),
    });
    updatePost.mockResolvedValueOnce({
      id: "post-1",
      slug: "post-1",
      published: true,
      category: null,
      tags: [],
    });
    updateCoverAssetRecord.mockResolvedValueOnce({});

    const { backfillMissingPostCovers } = await import("../cover-assets");
    const result = await backfillMissingPostCovers({
      publishedOnly: false,
      replaceExisting: true,
    });

    const where = findManyPosts.mock.calls[0]?.[0]?.where;
    expect(where).toMatchObject({
      deletedAt: null,
      generatedByAiNews: false,
    });
    expect(where.published).toBeUndefined();
    expect(where.OR).toBeUndefined();
    expect(updatePost).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1" },
      data: {
        coverImage: "https://cdn.example.com/covers/uploaded.jpg",
        coverAssetId: "cover-1",
      },
    }));
    expect(result).toEqual({ updated: 1, skipped: 0 });
  });
});
