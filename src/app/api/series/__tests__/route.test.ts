import { beforeEach, describe, expect, test, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    series: {
      findMany,
    },
  },
}));

describe("GET /api/series", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  test("returns only public series with at least one published post", async () => {
    findMany.mockResolvedValueOnce([{ id: "s1", title: "Series", slug: "series", _count: { posts: 1 } }]);

    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, data: [{ id: "s1", title: "Series", slug: "series", _count: { posts: 1 } }] });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        posts: {
          some: {
            deletedAt: null,
            published: true,
          },
        },
      },
    }));
  });
});
