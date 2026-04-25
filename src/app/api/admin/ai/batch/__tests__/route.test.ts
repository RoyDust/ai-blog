import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  createAiBatchTask: vi.fn(),
  resumeAiBatchTasks: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-batch-jobs", () => ({
  createAiBatchTask: mocks.createAiBatchTask,
  resumeAiBatchTasks: mocks.resumeAiBatchTasks,
}));

describe("admin AI batch route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.createAiBatchTask.mockResolvedValue({ id: "task-1", items: [{ id: "item-1" }] });
    mocks.resumeAiBatchTasks.mockResolvedValue(1);
  });

  test("creates a recoverable batch task", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: ["post-1"], actions: ["summary"], mode: "missing-only", apply: true }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(mocks.createAiBatchTask).toHaveBeenCalledWith({
      postIds: ["post-1"],
      actions: ["summary"],
      mode: "missing-only",
      apply: true,
      modelId: undefined,
      createdById: "admin-1",
    });
    expect(data).toMatchObject({ success: true, data: { id: "task-1" } });
  });

  test("resumes active batch tasks", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/batch?resume=1&taskId=task-1"));

    expect(response.status).toBe(200);
    expect(mocks.resumeAiBatchTasks).toHaveBeenCalledWith("task-1");
  });
});
