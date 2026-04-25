import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAiTasks: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/ai-tasks", () => ({
  listAiTasks: mocks.listAiTasks,
}));

describe("admin AI tasks route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.listAiTasks.mockResolvedValue({ tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
  });

  test("returns paginated AI tasks for admins", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/ai/tasks?status=FAILED&page=2"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listAiTasks).toHaveBeenCalledWith({ page: "2", limit: null, status: "FAILED", type: null });
    expect(data).toEqual({
      success: true,
      data: { tasks: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
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
