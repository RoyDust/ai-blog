import { describe, expect, test, afterEach, vi } from "vitest";

describe("operation log ingest secret", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test("uses the dedicated env var when configured", async () => {
    process.env.OPERATION_LOG_INGEST_SECRET = "dedicated-secret";
    const { resolveOperationLogIngestSecret } = await import("../api-operation-log-ingest-secret");

    expect(resolveOperationLogIngestSecret()).toBe("dedicated-secret");
  });

  test("falls back to the dev secret outside production", async () => {
    delete process.env.OPERATION_LOG_INGEST_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    const { resolveOperationLogIngestSecret } = await import("../api-operation-log-ingest-secret");

    expect(resolveOperationLogIngestSecret()).toBe("development-operation-log-ingest");
  });

  test("returns null in production when the dedicated secret is missing (no AUTH_SECRET reuse)", async () => {
    delete process.env.OPERATION_LOG_INGEST_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { resolveOperationLogIngestSecret } = await import("../api-operation-log-ingest-secret");

    expect(resolveOperationLogIngestSecret()).toBeNull();
    // fail-loud：生产缺配必须发出告警，避免审计日志静默丢失。
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toContain("OPERATION_LOG_INGEST_SECRET is not configured");
  });

  test("warns only once for a missing production secret", async () => {
    delete process.env.OPERATION_LOG_INGEST_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    const { resolveOperationLogIngestSecret } = await import("../api-operation-log-ingest-secret");

    resolveOperationLogIngestSecret();
    resolveOperationLogIngestSecret();
    resolveOperationLogIngestSecret();

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
