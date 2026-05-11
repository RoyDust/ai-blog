import { beforeEach, describe, expect, test, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api-errors";

const { requireAdminSessionMock, postFindManyMock, commentFindManyMock } = vi.hoisted(() => ({
  requireAdminSessionMock: vi.fn(),
  postFindManyMock: vi.fn(),
  commentFindManyMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: postFindManyMock,
    },
    comment: {
      findMany: commentFindManyMock,
    },
  },
}));

describe("GET /api/admin/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    postFindManyMock.mockResolvedValue([]);
    commentFindManyMock.mockResolvedValue([]);
  });

  test("returns empty remote results for short queries", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/search?q=a"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: {
        query: "a",
        results: { posts: [], comments: [] },
      },
    });
    expect(postFindManyMock).not.toHaveBeenCalled();
    expect(commentFindManyMock).not.toHaveBeenCalled();
  });

  test("searches posts and comments for admins", async () => {
    postFindManyMock.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "Searchable Post",
        slug: "searchable-post",
        published: true,
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      },
    ]);
    commentFindManyMock.mockResolvedValueOnce([
      {
        id: "comment-1",
        content: "This comment mentions searchable content.",
        status: "PENDING",
        authorLabel: "Reader",
        createdAt: new Date("2026-05-10T00:00:00Z"),
        post: { title: "Searchable Post", slug: "searchable-post" },
      },
    ]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/search?q= searchable "));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(postFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        OR: expect.arrayContaining([
          { title: { contains: "searchable", mode: "insensitive" } },
          { slug: { contains: "searchable", mode: "insensitive" } },
        ]),
      }),
      take: 5,
    }));
    expect(commentFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    expect(payload.data.results.posts).toEqual([
      {
        id: "post-1",
        type: "posts",
        title: "Searchable Post",
        subtitle: "searchable-post",
        href: "/admin/posts/post-1/edit",
        badge: "已发布",
      },
    ]);
    expect(payload.data.results.comments[0]).toMatchObject({
      id: "comment-1",
      type: "comments",
      title: "This comment mentions searchable content.",
      subtitle: "Reader 评论于《Searchable Post》",
      href: "/admin/comments",
      badge: "待审核",
    });
  });

  test("requires an admin session", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/search?q=post"));

    expect(response.status).toBe(401);
    expect(postFindManyMock).not.toHaveBeenCalled();
    expect(commentFindManyMock).not.toHaveBeenCalled();
  });
});
