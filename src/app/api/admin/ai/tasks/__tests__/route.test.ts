import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAiTasks: vi.fn(),
  resumeAiBatchTasks: vi.fn(),
  resumePostSummaryJobs: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-tasks", () => ({
  listAiTasks: mocks.listAiTasks,
}));

vi.mock("@/lib/ai-batch-jobs", () => ({
  MAX_OBSERVED_AI_TASKS: 50,
  resumeAiBatchTasks: mocks.resumeAiBatchTasks,
}));

vi.mock("@/lib/post-summary-jobs", () => ({
  resumePostSummaryJobs: mocks.resumePostSummaryJobs,
}));

describe("admin AI tasks route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.listAiTasks.mockResolvedValue({ tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
    mocks.resumeAiBatchTasks.mockResolvedValue(2);
    mocks.resumePostSummaryJobs.mockResolvedValue(1);
  });

  test("returns paginated AI tasks for admins and keeps GET free of resume side effects", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/tasks?status=FAILED&page=2&resume=1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listAiTasks).toHaveBeenCalledWith({ page: "2", limit: null, status: "FAILED", type: null });
    expect(mocks.resumeAiBatchTasks).not.toHaveBeenCalled();
    expect(mocks.resumePostSummaryJobs).not.toHaveBeenCalled();
    expect(data).toEqual({
      success: true,
      data: { tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    });
  });

  test("resumes active AI tasks only on explicit POST", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: ["task-1", "task-2", "task-1"], includeSummaryJobs: true }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(mocks.resumeAiBatchTasks.mock.calls).toEqual([["task-1"], ["task-2"], []]);
    expect(mocks.resumePostSummaryJobs).toHaveBeenCalledTimes(1);
    expect(data).toEqual({
      success: true,
      data: { resumedBatchTasks: 6, resumedSummaryJobs: 1 },
    });
  });

  test("rejects anonymous requests", async () => {
    const { UnauthorizedError } = await import("@/lib/api-errors");
    mocks.requireAdminSession.mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/tasks"));

    expect(response.status).toBe(401);
  });
});
