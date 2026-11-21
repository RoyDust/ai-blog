import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  getAiTaskDetailMock,
  getServerSessionMock,
  listAiTasksMock,
  redirectError,
  redirectMock,
  renderArticlePageMock,
} = vi.hoisted(() => {
  const nextRedirectError = new Error("NEXT_REDIRECT");
  return {
    getAiTaskDetailMock: vi.fn(),
    getServerSessionMock: vi.fn(),
    listAiTasksMock: vi.fn(),
    redirectError: nextRedirectError,
    redirectMock: vi.fn(() => {
      throw nextRedirectError;
    }),
    renderArticlePageMock: vi.fn(),
  };
});

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    redirect: redirectMock,
  };
});

vi.mock("@/lib/ai-tasks", () => ({
  listAiTasks: listAiTasksMock,
  getAiTaskDetail: getAiTaskDetailMock,
}));

vi.mock("@/app/(public)/posts/[slug]/page", () => ({
  renderArticlePage: renderArticlePageMock,
}));

describe("server-rendered admin subpages real-time role guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("AdminAiTasksPage redirects demoted USER sessions before querying AI tasks", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });

    const { default: AdminAiTasksPage } = await import("../ai/tasks/page");

    await expect(AdminAiTasksPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&error=not-admin&callbackUrl=%2Fadmin");
    expect(listAiTasksMock).not.toHaveBeenCalled();
  });

  test("AdminAiTaskDetailPage redirects demoted USER sessions before querying AI task detail", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });

    const { default: AdminAiTaskDetailPage } = await import("../ai/tasks/[id]/page");

    await expect(AdminAiTaskDetailPage({ params: Promise.resolve({ id: "task-1" }) })).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&error=not-admin&callbackUrl=%2Fadmin");
    expect(getAiTaskDetailMock).not.toHaveBeenCalled();
  });

  test("AdminPostPreviewPage redirects demoted USER sessions before reading unpublished drafts", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });

    const { default: AdminPostPreviewPage } = await import("../posts/preview/[slug]/page");

    await expect(AdminPostPreviewPage({ params: Promise.resolve({ slug: "secret-draft" }) })).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&error=not-admin&callbackUrl=%2Fadmin");
    expect(renderArticlePageMock).not.toHaveBeenCalled();
  });
});
