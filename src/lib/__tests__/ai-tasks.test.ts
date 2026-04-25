import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  aiTaskCreate: vi.fn(),
  aiTaskFindUnique: vi.fn(),
  aiTaskUpdate: vi.fn(),
  aiTaskCount: vi.fn(),
  aiTaskFindMany: vi.fn(),
  aiTaskItemFindMany: vi.fn(),
  aiTaskItemUpdate: vi.fn(),
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
});
