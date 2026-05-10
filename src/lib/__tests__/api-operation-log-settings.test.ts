import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: prismaMocks.queryRawUnsafe,
    $executeRawUnsafe: prismaMocks.executeRawUnsafe,
  },
}));

import {
  DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES,
  enforceApiOperationLogStorageLimit,
  getApiOperationLogSettingsSummary,
  normalizeApiOperationLogMaxStorageBytes,
  updateApiOperationLogMaxStorageBytes,
} from "@/lib/api-operation-log-settings";

describe("api operation log settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("normalizes human-readable storage limits", () => {
    expect(normalizeApiOperationLogMaxStorageBytes("10m")).toBe(10 * 1024 * 1024);
    expect(normalizeApiOperationLogMaxStorageBytes("12mb")).toBe(12 * 1024 * 1024);
    expect(() => normalizeApiOperationLogMaxStorageBytes("0.5m")).toThrow("between 1 MB and 512 MB");
  });

  test("returns default limit and storage stats", async () => {
    prismaMocks.queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ bytes: BigInt(2048), rowCount: BigInt(3) }]);

    await expect(getApiOperationLogSettingsSummary()).resolves.toEqual({
      maxStorageBytes: DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES,
      maxStorageMb: 10,
      currentStorageBytes: 2048,
      currentStorageLabel: "2 KB",
      rowCount: 3,
    });
  });

  test("falls back to the default limit when the settings table is missing", async () => {
    prismaMocks.queryRawUnsafe
      .mockRejectedValueOnce(Object.assign(new Error('relation "system_settings" does not exist'), { code: "42P01" }))
      .mockResolvedValueOnce([{ bytes: 0, rowCount: 0 }]);

    await expect(getApiOperationLogSettingsSummary()).resolves.toMatchObject({
      maxStorageBytes: DEFAULT_API_OPERATION_LOG_MAX_STORAGE_BYTES,
      maxStorageMb: 10,
    });
  });

  test("persists the limit and trims oldest logs", async () => {
    prismaMocks.executeRawUnsafe.mockResolvedValueOnce(1).mockResolvedValueOnce(4);

    const result = await updateApiOperationLogMaxStorageBytes("16m");

    expect(result).toEqual({ maxStorageBytes: 16 * 1024 * 1024, deletedCount: 4 });
    expect(prismaMocks.executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO "system_settings"'),
      "apiOperationLog.maxStorageBytes",
      JSON.stringify({ maxStorageBytes: 16 * 1024 * 1024 }),
    );
    expect(prismaMocks.executeRawUnsafe).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM "api_operation_logs"'), 16 * 1024 * 1024);
  });

  test("enforces the configured limit from settings", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([{ value: { maxStorageBytes: 8 * 1024 * 1024 } }]);
    prismaMocks.executeRawUnsafe.mockResolvedValueOnce(2);

    await expect(enforceApiOperationLogStorageLimit()).resolves.toEqual({ deletedCount: 2 });
    expect(prismaMocks.executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("newest_bytes > $1"), 8 * 1024 * 1024);
  });
});
