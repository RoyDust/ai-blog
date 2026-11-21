import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  resumeAiBatchTasks: vi.fn(),
  resumePostSummaryJobs: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-batch-jobs", () => ({
  MAX_OBSERVED_AI_TASKS: 50,
  resumeAiBatchTasks: mocks.resumeAiBatchTasks,
}));

vi.mock("@/lib/post-summary-jobs", () => ({
  resumePostSummaryJobs: mocks.resumePostSummaryJobs,
}));

describe("POST /api/admin/ai/tasks/resume", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.resumeAiBatchTasks.mockResolvedValue(1);
    mocks.resumePostSummaryJobs.mockResolvedValue(0);
  });

  test("resumes queued/running batch tasks when body is empty", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/tasks/resume", { method: "POST" }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(mocks.resumeAiBatchTasks).toHaveBeenCalledWith();
    expect(mocks.resumePostSummaryJobs).not.toHaveBeenCalled();
    expect(payload).toEqual({
      success: true,
      data: { resumedBatchTasks: 1, resumedSummaryJobs: 0 },
    });
  });

  test("validates malformed JSON and oversized taskIds payloads", async () => {
    const { POST } = await import("../route");

    const badJsonResponse = await POST(
      new Request("http://localhost/api/admin/ai/tasks/resume", {
        method: "POST",
        body: "{bad-json",
      }),
    );
    expect(badJsonResponse.status).toBe(400);

    const oversizedResponse = await POST(
      new Request("http://localhost/api/admin/ai/tasks/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: Array.from({ length: 51 }, (_, index) => `task-${index}`) }),
      }),
    );
    expect(oversizedResponse.status).toBe(400);
    expect(mocks.resumeAiBatchTasks).not.toHaveBeenCalled();
  });
});
