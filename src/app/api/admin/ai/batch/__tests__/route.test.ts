import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  createAiBatchTask: vi.fn(),
  resumeAiBatchTasks: vi.fn(),
  getAiBatchTaskSnapshot: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-batch-jobs", () => ({
  createAiBatchTask: mocks.createAiBatchTask,
  resumeAiBatchTasks: mocks.resumeAiBatchTasks,
  getAiBatchTaskSnapshot: mocks.getAiBatchTaskSnapshot,
}));

describe("admin AI batch route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.createAiBatchTask.mockResolvedValue({ id: "task-1", items: [{ id: "item-1" }] });
    mocks.resumeAiBatchTasks.mockResolvedValue(1);
    mocks.getAiBatchTaskSnapshot.mockResolvedValue({ active: false, tasks: [], missingTaskIds: [] });
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

  test("reads observed task snapshots without scheduling work", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/batch?taskId=one&taskId=two"));
    expect(await response.json()).toEqual({ success: true, data: { active: false, tasks: [], missingTaskIds: [] } });
    expect(mocks.getAiBatchTaskSnapshot).toHaveBeenCalledWith(["one", "two"]);
    expect(mocks.resumeAiBatchTasks).not.toHaveBeenCalled();
  });

  test("recovers every observed task while preserving the bounded snapshot validation", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/batch?resume=1&taskId=one&taskId=two&taskId=one"));
    expect(response.status).toBe(200);
    expect(mocks.resumeAiBatchTasks.mock.calls).toEqual([["one"], ["two"]]);
    const { ValidationError } = await import("@/lib/api-errors");
    mocks.getAiBatchTaskSnapshot.mockRejectedValueOnce(new ValidationError("too many tasks"));
    mocks.resumeAiBatchTasks.mockClear();
    expect((await GET(new Request("http://localhost/api/admin/ai/batch?resume=1&taskId=invalid"))).status).toBe(400);
    expect(mocks.resumeAiBatchTasks).not.toHaveBeenCalled();
  });
});
