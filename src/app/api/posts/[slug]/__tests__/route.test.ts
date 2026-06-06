import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst,
      update,
    },
  },
}));

describe("GET /api/posts/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("counts only approved comments in the public post payload", async () => {
    findFirst.mockResolvedValueOnce({
      id: "post-1",
      slug: "hello",
      title: "Hello",
      comments: [],
      _count: { comments: 2, likes: 1 },
    });
    update.mockResolvedValueOnce({});

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/posts/hello"), {
      params: Promise.resolve({ slug: "hello" }),
    });

    expect(response.status).toBe(200);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        _count: {
          select: {
            comments: { where: { deletedAt: null, status: "APPROVED" } },
            likes: true,
          },
        },
      }),
    }));
  });
});
