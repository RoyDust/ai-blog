import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aiTaskFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiTask: {
      findMany: mocks.aiTaskFindMany,
      update: vi.fn(),
    },
    aiTaskItem: {
      findMany: vi.fn(),
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
  markAiTaskItemFailed: vi.fn(),
  markAiTaskItemRunning: vi.fn(),
  markAiTaskItemSkipped: vi.fn(),
  markAiTaskItemSucceeded: vi.fn(),
  markAiTaskRunning: vi.fn(),
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
  buildPostAiInputSnapshot: vi.fn(),
  getPostForAiAction: vi.fn(),
  normalizePostAiAction: (action: string) => action,
  runPostAiAction: vi.fn(),
}));

describe("AI batch job resume", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("targeted resume includes retry task types handled by the batch runner", async () => {
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
            "post-article-info",
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
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });
});
