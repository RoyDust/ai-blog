import { beforeEach, describe, expect, test, vi } from "vitest";

const articleInfoActions = ["slug", "summary", "seo-description", "category", "tags"];

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  createAiTask: vi.fn(),
  markAiTaskRunning: vi.fn(),
  markAiTaskItemRunning: vi.fn(),
  markAiTaskItemSucceeded: vi.fn(),
  markAiTaskItemFailed: vi.fn(),
  refreshAiTaskCounts: vi.fn(),
  buildDraftPostForAiAction: vi.fn(),
  buildPostAiInputSnapshot: vi.fn(),
  getPostForAiAction: vi.fn(),
  runPostAiAction: vi.fn(),
  aiTaskUpdate: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-tasks", () => ({
  AI_TASK_ITEM_STATUSES: { queued: "QUEUED" },
  createAiTask: mocks.createAiTask,
  markAiTaskRunning: mocks.markAiTaskRunning,
  markAiTaskItemRunning: mocks.markAiTaskItemRunning,
  markAiTaskItemSucceeded: mocks.markAiTaskItemSucceeded,
  markAiTaskItemFailed: mocks.markAiTaskItemFailed,
  refreshAiTaskCounts: mocks.refreshAiTaskCounts,
}));

vi.mock("@/lib/ai-post-actions", () => ({
  POST_AI_ACTIONS: {
    summary: "summary",
    seoDescription: "seo-description",
    title: "title",
    slug: "slug",
    tags: "tags",
    category: "category",
    coverImage: "cover-image",
  },
  buildDraftPostForAiAction: mocks.buildDraftPostForAiAction,
  buildPostAiInputSnapshot: mocks.buildPostAiInputSnapshot,
  getPostForAiAction: mocks.getPostForAiAction,
  runPostAiAction: mocks.runPostAiAction,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiTask: {
      update: mocks.aiTaskUpdate,
    },
  },
}));

describe("admin one-click article info AI action", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.buildDraftPostForAiAction.mockResolvedValue({
      id: "draft",
      title: "草稿标题",
      slug: "cao-gao-biao-ti",
      content: "正文",
      excerpt: null,
      seoDescription: null,
      category: null,
      tags: [],
      published: false,
    });
    mocks.buildPostAiInputSnapshot.mockImplementation((_post, action) => ({ action, title: "草稿标题" }));
    mocks.createAiTask.mockResolvedValue({
      id: "task-1",
      modelId: null,
      items: articleInfoActions.map((action) => ({ id: `item-${action}`, action })),
    });
    mocks.runPostAiAction.mockImplementation((_input: { action: string }) => {
      const outputByAction: Record<string, unknown> = {
        slug: { slug: "ai-generated-info" },
        summary: { summary: "AI 一键生成摘要。" },
        "seo-description": { seoDescription: "AI 一键生成 SEO。" },
        category: { categoryId: "cat-1", categoryName: "前端", categorySlug: "frontend" },
        tags: { existingTagIds: ["tag-1"], names: ["React"], tagSlugs: ["react"] },
      };

      return Promise.resolve({ modelId: "model-1", output: outputByAction[_input.action] });
    });
  });

  test("creates one AI task with article info items and returns normalized editor payload", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/actions/article-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "post-1", draft: { title: "保留标题", content: "正文" } }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "post-article-info",
        source: "single-post",
        createdById: "admin-1",
        metadata: expect.objectContaining({ oneClick: true, preserve: ["title", "content"] }),
        items: articleInfoActions.map((action) =>
          expect.objectContaining({
            postId: "post-1",
            action,
            inputSnapshot: expect.objectContaining({ oneClick: true, preserve: ["title", "content"] }),
          }),
        ),
      }),
    );
    expect(mocks.markAiTaskRunning).toHaveBeenCalledWith("task-1");
    expect(mocks.markAiTaskItemSucceeded).toHaveBeenCalledTimes(5);
    expect(data).toMatchObject({
      success: true,
      data: {
        taskId: "task-1",
        modelId: "model-1",
        articleInfo: {
          slug: "ai-generated-info",
          excerpt: "AI 一键生成摘要。",
          seoDescription: "AI 一键生成 SEO。",
          categoryId: "cat-1",
          categoryName: "前端",
          categorySlug: "frontend",
          tagIds: ["tag-1"],
          tagNames: ["React"],
          tagSlugs: ["react"],
        },
      },
    });
  });
});
