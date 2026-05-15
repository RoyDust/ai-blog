import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  retryAiTaskFailedItems: vi.fn(),
  resumeAiBatchTasks: vi.fn(),
  resumePostSummaryJobs: vi.fn(),
  postUpdateMany: vi.fn(),
}));

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-tasks", () => ({
  retryAiTaskFailedItems: mocks.retryAiTaskFailedItems,
}));

vi.mock("@/lib/ai-batch-jobs", () => ({
  resumeAiBatchTasks: mocks.resumeAiBatchTasks,
}));

vi.mock("@/lib/post-summary-jobs", () => ({
  resumePostSummaryJobs: mocks.resumePostSummaryJobs,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      updateMany: mocks.postUpdateMany,
    },
  },
}));

describe("POST /api/admin/ai/tasks/[id]/retry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.resumeAiBatchTasks.mockResolvedValue(1);
    mocks.resumePostSummaryJobs.mockResolvedValue(1);
    mocks.postUpdateMany.mockResolvedValue({ count: 1 });
  });

  test("resumes single-post AI retry tasks through the batch runner", async () => {
    mocks.retryAiTaskFailedItems.mockResolvedValueOnce({
      id: "retry-cover-1",
      type: "post-cover-image",
      modelId: "model-1",
      metadata: {},
      items: [{ id: "item-1", postId: "post-1" }],
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/tasks/task-1/retry", { method: "POST" }), {
      params: Promise.resolve({ id: "task-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.success).toBe(true);
    expect(mocks.retryAiTaskFailedItems).toHaveBeenCalledWith("task-1", "admin-1");
    expect(mocks.resumeAiBatchTasks).toHaveBeenCalledWith("retry-cover-1");
    expect(mocks.resumePostSummaryJobs).not.toHaveBeenCalled();
  });
});
