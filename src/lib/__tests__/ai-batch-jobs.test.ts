import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiTaskFindMany: vi.fn(),
  items: vi.fn(), running: vi.fn(), itemRunning: vi.fn(), failed: vi.fn(), complete: vi.fn(), post: vi.fn(), generate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiTask: {
      findMany: mocks.aiTaskFindMany,
      update: vi.fn(),
    },
    aiTaskItem: {
      findMany: mocks.items,
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/ai-tasks", () => ({
  AI_TASK_ITEM_STATUSES: {
    queued: "QUEUED",
    running: "RUNNING",
  },
  createAiTask: vi.fn(),
  isAiTaskActive: (status: string | null | undefined) => status === "QUEUED" || status === "RUNNING",
  markAiTaskItemFailed: mocks.failed,
  markAiTaskItemRunning: mocks.itemRunning,
  markAiTaskItemSkipped: vi.fn(),
  markAiTaskItemSucceeded: vi.fn(),
  markAiTaskRunning: mocks.running,
  refreshAiTaskCounts: vi.fn(),
}));

vi.mock("@/lib/ai-post-actions", () => ({
  POST_AI_ACTIONS: {
    summary: "summary",
    seoDescription: "seo-description",
    tags: "tags",
    category: "category",
    coverImage: "cover-image",
  },
  applyPostAiTaskItem: vi.fn(),
  completePostAiTaskItem: mocks.complete,
  buildPostAiInputSnapshot: vi.fn(),
  getPostForAiAction: mocks.post,
  normalizePostAiAction: (action: string) => action,
  runPostAiAction: mocks.generate,
}));

describe("AI batch job resume", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("targeted resume only includes task types handled by the batch runner", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => 1 as unknown as ReturnType<typeof setTimeout>);
    mocks.aiTaskFindMany.mockResolvedValueOnce([
      {
        id: "retry-title-1",
        modelId: "model-1",
        metadata: {},
        status: "QUEUED",
      },
    ]);

    const { resumeAiBatchTasks } = await import("../ai-batch-jobs");
    const resumed = await resumeAiBatchTasks("retry-title-1");

    expect(resumed).toBe(1);
    expect(mocks.aiTaskFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "retry-title-1",
        type: {
          in: expect.arrayContaining([
            "post-bulk-completion",
            "post-seo-description",
            "post-title-suggestion",
            "post-slug-suggestion",
            "post-tag-suggestion",
            "post-category-suggestion",
            "post-cover-image",
          ]),
        },
      },
      take: 1,
    }));
    expect(mocks.aiTaskFindMany.mock.calls[0]?.[0]?.where.type.in).not.toContain("post-article-info");
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  test("does not convert a transaction failure into a model failure", async () => {
    mocks.running.mockResolvedValue({ id: "task-1", status: "RUNNING" });
    mocks.items.mockResolvedValue([{ id: "item-1", taskId: "task-1", postId: "post-1", action: "summary", inputSnapshot: {} }]);
    mocks.itemRunning.mockResolvedValue({ id: "item-1" });
    mocks.post.mockResolvedValue({ id: "post-1" });
    mocks.generate.mockResolvedValue({ modelId: "model-1", output: { summary: "summary" } });
    mocks.complete.mockRejectedValue(new Error("recipient unavailable"));
    const { runAiBatchTask } = await import("../ai-batch-jobs");
    await expect(runAiBatchTask({ taskId: "task-1", apply: true })).rejects.toThrow("recipient unavailable");
    expect(mocks.failed).not.toHaveBeenCalled();
  });

  test("observes bounded explicit task IDs including their stable terminal snapshots", async () => {
    const updatedAt = new Date("2026-09-20T00:00:00Z");
    mocks.aiTaskFindMany.mockResolvedValue([{ id: "task-1", status: "SUCCEEDED", requestedCount: 1, succeededCount: 1, failedCount: 0, updatedAt, items: [{ id: "item-1", status: "SUCCEEDED", updatedAt }] }]);
    const { getAiBatchTaskSnapshot } = await import("../ai-batch-jobs");
    const first = await getAiBatchTaskSnapshot(["task-1"]);
    const second = await getAiBatchTaskSnapshot(["task-1"]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ active: false, tasks: [{ id: "task-1", status: "SUCCEEDED", counts: { requested: 1, succeeded: 1 }, version: expect.any(String) }] });
    expect(mocks.aiTaskFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: { in: ["task-1"] } }, take: 50 }));
    mocks.aiTaskFindMany.mockClear();
    expect(await getAiBatchTaskSnapshot([])).toEqual({ active: false, tasks: [], missingTaskIds: [] });
    expect(mocks.aiTaskFindMany).not.toHaveBeenCalled();
    await expect(getAiBatchTaskSnapshot(Array.from({ length: 51 }, (_, i) => "task-" + i))).rejects.toThrow();
  });
});
