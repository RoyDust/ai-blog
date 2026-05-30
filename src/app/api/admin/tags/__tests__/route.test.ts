import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const count = vi.fn();
const findMany = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      count,
      findMany,
    },
  },
}));

describe("GET /api/admin/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("paginates tag management rows on the server", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    count.mockResolvedValueOnce(31);
    findMany.mockResolvedValueOnce([{ id: "tag-21", name: "React", slug: "react" }]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/tags?page=3&limit=10&q=react"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 10,
      where: expect.objectContaining({
        OR: expect.any(Array),
      }),
    }));
    expect(payload.pagination).toEqual({ page: 3, limit: 10, total: 31, totalPages: 4 });
  });
});
