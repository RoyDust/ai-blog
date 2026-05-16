import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getDashboardStats: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/admin-stats", () => ({
  getDashboardStats: mocks.getDashboardStats,
}));

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.getDashboardStats.mockResolvedValue({ range: 30, visits: {}, reading: {}, engagement: {} });
  });

  test("returns dashboard stats for admins", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/stats?range=30"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireAdminSession).toHaveBeenCalledTimes(1);
    expect(mocks.getDashboardStats).toHaveBeenCalledWith("30");
    expect(data).toEqual({
      success: true,
      data: { range: 30, visits: {}, reading: {}, engagement: {} },
    });
  });

  test("rejects anonymous requests", async () => {
    const { UnauthorizedError } = await import("@/lib/api-errors");
    mocks.requireAdminSession.mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/stats"));

    expect(response.status).toBe(401);
  });
});
