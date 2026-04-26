import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  createAiTask: vi.fn(),
  markAiTaskRunning: vi.fn(),
  markAiTaskItemRunning: vi.fn(),
  markAiTaskItemSucceeded: vi.fn(),
  markAiTaskItemFailed: vi.fn(),
  buildDraftPostForAiAction: vi.fn(),
  buildPostAiInputSnapshot: vi.fn(),
  getAiTaskTypeForAction: vi.fn(),
  getPostForAiAction: vi.fn(),
  normalizePostAiAction: vi.fn(),
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
}));

vi.mock("@/lib/ai-post-actions", () => ({
  buildDraftPostForAiAction: mocks.buildDraftPostForAiAction,
  buildPostAiInputSnapshot: mocks.buildPostAiInputSnapshot,
  getAiTaskTypeForAction: mocks.getAiTaskTypeForAction,
  getPostForAiAction: mocks.getPostForAiAction,
  normalizePostAiAction: mocks.normalizePostAiAction,
  runPostAiAction: mocks.runPostAiAction,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiTask: {
      update: mocks.aiTaskUpdate,
    },
  },
}));

describe("admin AI actions route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.normalizePostAiAction.mockReturnValue("seo-description");
    mocks.getAiTaskTypeForAction.mockReturnValue("post-seo-description");
    mocks.getPostForAiAction.mockResolvedValue({ id: "post-1", title: "标题" });
    mocks.buildDraftPostForAiAction.mockResolvedValue({
      id: "draft",
      title: "草稿",
      slug: "cao-gao",
      content: "正文",
      excerpt: null,
      seoDescription: null,
      category: null,
      tags: [],
      published: false,
    });
    mocks.buildPostAiInputSnapshot.mockReturnValue({ title: "标题" });
    mocks.createAiTask.mockResolvedValue({ id: "task-1", modelId: null, items: [{ id: "item-1" }] });
    mocks.runPostAiAction.mockResolvedValue({ modelId: "model-1", output: { seoDescription: "SEO 描述" } });
  });

  test("generates a single-post AI suggestion without applying it", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: "post-1", action: "seo-description" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.markAiTaskItemSucceeded).toHaveBeenCalledWith("item-1", { seoDescription: "SEO 描述" });
    expect(data).toEqual({
      success: true,
      data: {
        taskId: "task-1",
        itemId: "item-1",
        action: "seo-description",
        modelId: "model-1",
        output: { seoDescription: "SEO 描述" },
      },
    });
  });

  test("generates a draft AI suggestion without requiring a saved post", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: { title: "草稿", content: "正文" }, action: "seo-description" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getPostForAiAction).not.toHaveBeenCalled();
    expect(mocks.buildDraftPostForAiAction).toHaveBeenCalledWith({ title: "草稿", content: "正文" });
    expect(mocks.createAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "draft-post",
        metadata: { draft: true },
        items: [
          expect.objectContaining({
            postId: null,
            action: "seo-description",
            inputSnapshot: { title: "标题", draft: true },
          }),
        ],
      }),
    );
    expect(data).toEqual({
      success: true,
      data: {
        taskId: "task-1",
        itemId: "item-1",
        action: "seo-description",
        modelId: "model-1",
        output: { seoDescription: "SEO 描述" },
      },
    });
  });
});
