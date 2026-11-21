import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const getServerSessionMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: findFirstMock,
    },
  },
}));

describe("/posts/[slug]/edit server redirect page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects unauthenticated visitors to login prompt with callbackUrl", async () => {
    getServerSessionMock.mockResolvedValueOnce(null);

    const { default: EditPostPage } = await import("../page");

    await expect(
      EditPostPage({ params: Promise.resolve({ slug: "old-post" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/?login=1&callbackUrl=%2Fposts%2Fold-post%2Fedit");

    expect(redirectMock).toHaveBeenCalledWith("/?login=1&callbackUrl=%2Fposts%2Fold-post%2Fedit");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  test("redirects non-admin users to login prompt with not-admin error", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: "user-1", role: "USER" },
    });

    const { default: EditPostPage } = await import("../page");

    await expect(
      EditPostPage({ params: Promise.resolve({ slug: "old-post" }) }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/?login=1&error=not-admin&callbackUrl=%2Fposts%2Fold-post%2Fedit",
    );

    expect(redirectMock).toHaveBeenCalledWith(
      "/?login=1&error=not-admin&callbackUrl=%2Fposts%2Fold-post%2Fedit",
    );
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  test("calls notFound when admin visits an unknown or soft-deleted post slug", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "ADMIN" },
    });
    findFirstMock.mockResolvedValueOnce(null);

    const { default: EditPostPage } = await import("../page");

    await expect(
      EditPostPage({ params: Promise.resolve({ slug: "missing-post" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { slug: "missing-post", deletedAt: null },
      select: { id: true },
    });
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("redirects admin users to the canonical admin post workspace by post id", async () => {
    getServerSessionMock.mockResolvedValueOnce({
      user: { id: "admin-1", role: "ADMIN" },
    });
    findFirstMock.mockResolvedValueOnce({ id: "post-42" });

    const { default: EditPostPage } = await import("../page");

    await expect(
      EditPostPage({ params: Promise.resolve({ slug: "old-post" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/posts/post-42/edit");

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { slug: "old-post", deletedAt: null },
      select: { id: true },
    });
    expect(redirectMock).toHaveBeenCalledWith("/admin/posts/post-42/edit");
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
