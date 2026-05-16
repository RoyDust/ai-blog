import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
    vi.useRealTimers();
    getServerSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    touchCoverAssetUsage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("assigns a random library cover when publishing a post without a cover", async () => {
    const publishedAt = new Date("2026-05-17T01:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(publishedAt);

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
        publishedAt,
        scheduledAt: null,
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

  test("publishes immediately and clears any scheduled time", async () => {
    const publishedAt = new Date("2026-05-17T01:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(publishedAt);

    findFirst.mockResolvedValueOnce({
      slug: "draft-post",
      coverImage: "https://cdn.example.com/covers/existing.jpg",
      coverAssetId: "cover-1",
      category: null,
      tags: [],
    });
    update.mockResolvedValueOnce({
      slug: "draft-post",
      published: true,
      coverImage: "https://cdn.example.com/covers/existing.jpg",
      coverAssetId: "cover-1",
      category: null,
      tags: [],
    });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "post-1", published: true, scheduledAt: null }),
    }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        published: true,
        publishedAt,
        scheduledAt: null,
      }),
    }));
  });

  test("schedules a future publish without publishing immediately", async () => {
    const now = new Date("2026-05-17T01:00:00.000Z");
    const scheduledAt = "2026-05-17T02:00:00.000Z";
    vi.useFakeTimers();
    vi.setSystemTime(now);

    findFirst.mockResolvedValueOnce({
      slug: "draft-post",
      coverImage: "",
      coverAssetId: null,
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });
    update.mockResolvedValueOnce({
      slug: "draft-post",
      published: false,
      coverImage: "",
      coverAssetId: null,
      category: { slug: "engineering" },
      tags: [{ slug: "nextjs" }],
    });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "post-1", published: false, scheduledAt }),
    }));

    expect(response.status).toBe(200);
    expect(resolvePostCoverInput).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        published: false,
        publishedAt: null,
        scheduledAt: new Date(scheduledAt),
      }),
    }));
    expect(revalidatePublicContent).toHaveBeenCalledWith(expect.objectContaining({
      slug: null,
      previousSlug: "draft-post",
      categorySlug: null,
      previousCategorySlug: "engineering",
      tagSlugs: [],
      previousTagSlugs: ["nextjs"],
    }));
  });

  test("rejects current or past scheduled publish times", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T01:00:00.000Z"));

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/posts/publish", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "post-1", published: false, scheduledAt: "2026-05-17T01:00:00.000Z" }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Use immediate publish");
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
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
      data: {
        published: false,
        publishedAt: null,
        scheduledAt: null,
      },
    }));
  });

  test("draft clearing removes an existing scheduled time", async () => {
    findFirst.mockResolvedValueOnce({
      slug: "scheduled-post",
      coverImage: "",
      coverAssetId: null,
      category: null,
      tags: [],
    });
    update.mockResolvedValueOnce({
      slug: "scheduled-post",
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
      body: JSON.stringify({ id: "post-1", published: false, scheduledAt: null }),
    }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        published: false,
        publishedAt: null,
        scheduledAt: null,
      },
    }));
  });
});
