import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const getApiOperationLogSettingsSummary = vi.fn();
const updateApiOperationLogMaxStorageBytes = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/api-operation-log-settings", () => ({
  getApiOperationLogSettingsSummary,
  updateApiOperationLogMaxStorageBytes,
}));

describe("admin operation log settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("returns operation log settings", async () => {
    getApiOperationLogSettingsSummary.mockResolvedValueOnce({
      maxStorageBytes: 10 * 1024 * 1024,
      maxStorageMb: 10,
      currentStorageBytes: 4096,
      currentStorageLabel: "4 KB",
      rowCount: 5,
    });

    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      maxStorageMb: 10,
      currentStorageLabel: "4 KB",
      rowCount: 5,
      deletedCount: 0,
    });
  });

  test("updates operation log max storage from megabytes", async () => {
    updateApiOperationLogMaxStorageBytes.mockResolvedValueOnce({ maxStorageBytes: 12 * 1024 * 1024, deletedCount: 3 });
    getApiOperationLogSettingsSummary.mockResolvedValueOnce({
      maxStorageBytes: 12 * 1024 * 1024,
      maxStorageMb: 12,
      currentStorageBytes: 1024,
      currentStorageLabel: "1 KB",
      rowCount: 2,
    });

    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/settings/operation-logs", {
        method: "PATCH",
        body: JSON.stringify({ maxStorageMb: 12 }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateApiOperationLogMaxStorageBytes).toHaveBeenCalledWith("12mb");
    expect(payload.data).toMatchObject({
      maxStorageMb: 12,
      deletedCount: 3,
    });
  });
});
