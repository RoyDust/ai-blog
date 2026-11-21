import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const findFirst = vi.fn();
const postFindMany = vi.fn();
const postUpdateMany = vi.fn();
const revalidatePublicContent = vi.fn();

const txClient = {
  series: {
    findMany,
    updateMany,
  },
  post: {
    findMany: postFindMany,
    updateMany: postUpdateMany,
  },
};

const transaction = vi.fn(async (callback: (tx: typeof txClient) => unknown) => callback(txClient));

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
    series: {
      findMany,
      create,
      update,
      updateMany,
      findFirst,
    },
    post: {
      findMany: postFindMany,
      updateMany: postUpdateMany,
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}));

describe("/api/admin/series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    transaction.mockImplementation(async (callback: (tx: typeof txClient) => unknown) => callback(txClient));
  });

  test("lists non-deleted series for admins", async () => {
    findMany.mockResolvedValueOnce([{ id: "s1", title: "Series", slug: "series" }]);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { deletedAt: null },
    }));
  });

  test("rejects invalid slugs on create", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/series", {
      method: "POST",
      body: JSON.stringify({ title: "Bad", slug: "Bad Slug", order: 0 }),
    }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test("creates a series with validated input", async () => {
    create.mockResolvedValueOnce({ id: "s1", title: "Series", slug: "series" });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/series", {
      method: "POST",
      body: JSON.stringify({ title: "Series", slug: "series", description: "Start here", coverImage: "", order: 2 }),
    }));

    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith({
      data: {
        title: "Series",
        slug: "series",
        description: "Start here",
        coverImage: null,
        order: 2,
      },
    });
    expect(revalidatePublicContent).toHaveBeenCalledWith({ seriesSlug: "series" });
  });

  test("returns the shared field-specific message for an active slug conflict", async () => {
    create.mockRejectedValueOnce({ code: "P2002", meta: { target: ["slug"] } });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/series", {
      method: "POST",
      body: JSON.stringify({ title: "Series", slug: "series", order: 0 }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: "该 slug 已被使用，请更换后再试" });
  });

  test("updates a series and invalidates old and new public paths", async () => {
    findFirst.mockResolvedValueOnce({ id: "s1", slug: "old-series" });
    update.mockResolvedValueOnce({ id: "s1", title: "Series", slug: "new-series" });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/series", {
      method: "PATCH",
      body: JSON.stringify({ id: "s1", title: "Series", slug: "new-series", order: 1 }),
    }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: {
        title: "Series",
        slug: "new-series",
        description: null,
        coverImage: null,
        order: 1,
      },
    });
    expect(revalidatePublicContent).toHaveBeenCalledWith({
      seriesSlug: "new-series",
      previousSeriesSlug: "old-series",
    });
  });

  test("soft-deletes series, clears Post.seriesId = null in the same transaction, and revalidates affected posts", async () => {
    findMany.mockResolvedValueOnce([{ id: "s1", slug: "series" }]);
    postFindMany.mockResolvedValueOnce([
      {
        slug: "series-post-1",
        category: { slug: "engineering", deletedAt: null },
        tags: [{ slug: "nextjs" }],
      },
      {
        slug: "series-post-2",
        category: { slug: "deleted-cat", deletedAt: new Date("2026-01-01") },
        tags: [],
      },
    ]);
    updateMany.mockResolvedValueOnce({ count: 1 });
    postUpdateMany.mockResolvedValueOnce({ count: 2 });

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/series?id=s1", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(postFindMany).toHaveBeenCalledWith({
      where: { seriesId: { in: ["s1"] }, deletedAt: null },
      select: {
        slug: true,
        category: { select: { slug: true, deletedAt: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["s1"] }, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(postUpdateMany).toHaveBeenCalledWith({
      where: { seriesId: { in: ["s1"] }, deletedAt: null },
      data: { seriesId: null },
    });
    expect(revalidatePublicContent.mock.calls).toEqual([
      [{ previousSeriesSlug: "series" }],
      [{ slug: "series-post-1", categorySlug: "engineering", tagSlugs: ["nextjs"] }],
      [{ slug: "series-post-2", categorySlug: null, tagSlugs: [] }],
    ]);
  });

  test("returns 404 when deleting a missing or already soft-deleted series", async () => {
    findMany.mockResolvedValueOnce([]);

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/series?id=missing", { method: "DELETE" }));

    expect(response.status).toBe(404);
    expect(updateMany).not.toHaveBeenCalled();
    expect(postUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePublicContent).not.toHaveBeenCalled();
  });
});
