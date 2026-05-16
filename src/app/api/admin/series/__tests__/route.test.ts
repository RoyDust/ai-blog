import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const update = vi.fn();
const findFirst = vi.fn();
const revalidatePublicContent = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    series: {
      findMany,
      create,
      update,
      findFirst,
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

  test("soft-deletes a series without touching posts", async () => {
    findFirst.mockResolvedValueOnce({ id: "s1", slug: "series" });
    update.mockResolvedValueOnce({ id: "s1", deletedAt: new Date() });

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/series?id=s1", { method: "DELETE" }));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePublicContent).toHaveBeenCalledWith({ previousSeriesSlug: "series" });
  });
});
