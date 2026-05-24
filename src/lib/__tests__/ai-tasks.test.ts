import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  aiTaskCreate: vi.fn(),
  aiTaskFindUnique: vi.fn(),
  aiTaskUpdate: vi.fn(),
  aiTaskCount: vi.fn(),
  aiTaskFindMany: vi.fn(),
  aiTaskItemFindMany: vi.fn(),
  aiTaskItemUpdate: vi.fn(),
  createAdminNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiTask: {
      create: prismaMocks.aiTaskCreate,
      findUnique: prismaMocks.aiTaskFindUnique,
      update: prismaMocks.aiTaskUpdate,
      count: prismaMocks.aiTaskCount,
      findMany: prismaMocks.aiTaskFindMany,
    },
    aiTaskItem: {
      findMany: prismaMocks.aiTaskItemFindMany,
      update: prismaMocks.aiTaskItemUpdate,
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createAdminNotification: prismaMocks.createAdminNotification,
  NOTIFICATION_SEVERITIES: {
    success: "SUCCESS",
    warning: "WARNING",
    error: "ERROR",
  },
  NOTIFICATION_TYPES: {
    aiTaskSucceeded: "AI_TASK_SUCCEEDED",
    aiTaskFailed: "AI_TASK_FAILED",
    aiTaskPartialFailed: "AI_TASK_PARTIAL_FAILED",
  },
}));

describe("ai task service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prismaMocks.aiTaskCreate.mockImplementation(({ data }) => Promise.resolve({ id: "task-1", ...data, items: data.items?.create ?? [] }));
    prismaMocks.aiTaskUpdate.mockImplementation(({ data }) => Promise.resolve({ id: "task-1", ...data }));
  });

  test("creates a queued task with task items", async () => {
    const { createAiTask } = await import("../ai-tasks");

    await createAiTask({
      type: "post-summary",
      source: "bulk-posts",
      modelId: "model-1",
      items: [
        {
          postId: "post-1",
          action: "summary",
          inputSnapshot: { title: "第一篇" },
        },
      ],
    });

    expect(prismaMocks.aiTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "post-summary",
          status: "QUEUED",
          source: "bulk-posts",
          modelId: "model-1",
          requestedCount: 1,
          items: {
            create: [
              expect.objectContaining({
                postId: "post-1",
                action: "summary",
                status: "QUEUED",
              }),
            ],
          },
        }),
        include: { items: true },
      }),
    );
  });

  test("refreshes counts and resolves partial failures", async () => {
    prismaMocks.aiTaskItemFindMany.mockResolvedValueOnce([
      { status: "SUCCEEDED", error: null },
      { status: "FAILED", error: "timeout" },
      { status: "SKIPPED", error: null },
    ]);

    const { refreshAiTaskCounts } = await import("../ai-tasks");
    await refreshAiTaskCounts("task-1");

    expect(prismaMocks.aiTaskUpdate).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: expect.objectContaining({
        status: "PARTIAL_FAILED",
        requestedCount: 3,
        succeededCount: 1,
        failedCount: 1,
        lastError: "timeout",
      }),
    });
    expect(prismaMocks.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "AI_TASK_PARTIAL_FAILED",
      severity: "WARNING",
      actionUrl: "/admin/ai/tasks/task-1",
      entityType: "aiTask",
      entityId: "task-1",
      dedupeKey: "ai-task:task-1:PARTIAL_FAILED",
    }));
  });

  test("creates a retry task from failed items only", async () => {
    prismaMocks.aiTaskFindUnique.mockResolvedValueOnce({
      id: "task-1",
      type: "post-bulk-completion",
      source: "bulk-posts",
      modelId: "model-1",
      metadata: { apply: true },
      createdBy: null,
      items: [
        { id: "item-1", postId: "post-1", action: "summary", status: "FAILED", inputSnapshot: { title: "一" } },
        { id: "item-2", postId: "post-2", action: "tags", status: "SUCCEEDED", inputSnapshot: { title: "二" } },
      ],
    });

    const { retryAiTaskFailedItems } = await import("../ai-tasks");
    await retryAiTaskFailedItems("task-1", "admin-1");

    expect(prismaMocks.aiTaskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "post-bulk-completion",
          source: "retry",
          createdById: "admin-1",
          metadata: { retryOfTaskId: "task-1", apply: true, originalTaskType: "post-bulk-completion" },
          items: {
            create: [expect.objectContaining({ postId: "post-1", action: "summary" })],
          },
        }),
      }),
    );
  });

  test("rejects retry tasks for one-click article info jobs", async () => {
    prismaMocks.aiTaskFindUnique.mockResolvedValueOnce({
      id: "task-1",
      type: "post-article-info",
      source: "draft-post",
      modelId: "model-1",
      metadata: { oneClick: true },
      createdBy: null,
      items: [{ id: "item-1", postId: null, action: "slug", status: "FAILED", inputSnapshot: { title: "草稿" } }],
    });

    const { retryAiTaskFailedItems } = await import("../ai-tasks");

    await expect(retryAiTaskFailedItems("task-1", "admin-1")).rejects.toThrow("一键文章信息任务请回到文章编辑器重新生成");
    expect(prismaMocks.aiTaskCreate).not.toHaveBeenCalled();
  });
});
