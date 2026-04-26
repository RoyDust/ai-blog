import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const revalidatePublicContent = vi.fn();
const resolvePostCoverInput = vi.fn();
const touchCoverAssetUsage = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}));

vi.mock("@/lib/cover-assets", () => ({
  resolvePostCoverInput,
  touchCoverAssetUsage,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst,
      update,
    },
  },
}));

describe("PATCH /api/admin/posts/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    touchCoverAssetUsage.mockResolvedValue(undefined);
  });

  test("assigns a random library cover when publishing a post without a cover", async () => {
    findFirst.mockResolvedValueOnce({
      slug: "draft-post",
      coverImage: "",
      coverAssetId: null,
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });
    resolvePostCoverInput.mockResolvedValueOnce({
      coverImage: "https://cdn.example.com/covers/random.jpg",
      coverAssetId: "cover-1",
      selectedAssetId: "cover-1",
    });
    update.mockResolvedValueOnce({
      slug: "draft-post",
      published: true,
      coverImage: "https://cdn.example.com/covers/random.jpg",
      coverAssetId: "cover-1",
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "post-1", published: true }),
    }));

    expect(response.status).toBe(200);
    expect(resolvePostCoverInput).toHaveBeenCalledWith({
      coverImage: "",
      coverAssetId: null,
      allowRandom: true,
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1" },
      data: expect.objectContaining({
        published: true,
        coverImage: "https://cdn.example.com/covers/random.jpg",
        coverAssetId: "cover-1",
      }),
    }));
    expect(touchCoverAssetUsage).toHaveBeenCalledWith("cover-1");
    expect(revalidatePublicContent).toHaveBeenCalledWith(expect.objectContaining({
      slug: "draft-post",
      categorySlug: "engineering",
      tagSlugs: ["nextjs"],
    }));
  });

  test("does not change covers when unpublishing", async () => {
    findFirst.mockResolvedValueOnce({
      slug: "published-post",
      coverImage: "",
      coverAssetId: null,
      category: null,
      tags: [],
    });
    update.mockResolvedValueOnce({
      slug: "published-post",
      published: false,
      coverImage: "",
      coverAssetId: null,
      category: null,
      tags: [],
    });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "post-1", published: false }),
    }));

    expect(response.status).toBe(200);
    expect(resolvePostCoverInput).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        coverImage: expect.anything(),
        coverAssetId: expect.anything(),
      }),
    }));
  });
});
