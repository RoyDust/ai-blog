import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const listApiOperationLogs = vi.fn();
const getApiOperationLog = vi.fn();
const purgeApiOperationLogs = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/api-operation-logs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-operation-logs")>("@/lib/api-operation-logs");
  return {
    ...actual,
    listApiOperationLogs,
    getApiOperationLog,
    purgeApiOperationLogs,
  };
});

describe("admin API operation logs routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("lists logs with filters", async () => {
    listApiOperationLogs.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      summary: { totalCount: 0, failedCount: 0, successCount: 0 },
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/logs?range=30&method=POST&status=5xx&page=2&includeSelf=1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(listApiOperationLogs).toHaveBeenCalledWith(expect.objectContaining({
      range: "30",
      page: "2",
      method: "POST",
      status: "5xx",
      includeSelf: true,
    }));
  });

  test("returns a log detail", async () => {
    getApiOperationLog.mockResolvedValueOnce({ id: "log-1", requestId: "req-1" });

    const { GET } = await import("../[id]/route");
    const response = await GET(new Request("http://localhost/api/admin/logs/log-1"), { params: Promise.resolve({ id: "log-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.requestId).toBe("req-1");
  });

  test("purges logs by retention window", async () => {
    purgeApiOperationLogs.mockResolvedValueOnce({ count: 3 });

    const { POST } = await import("../purge/route");
    const response = await POST(new Request("http://localhost/api/admin/logs/purge", {
      method: "POST",
      body: JSON.stringify({ retentionDays: 30 }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.count).toBe(3);
    expect(purgeApiOperationLogs).toHaveBeenCalledWith(30);
  });
});
