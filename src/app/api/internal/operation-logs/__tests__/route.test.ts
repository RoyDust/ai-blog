import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createApiOperationLog } = vi.hoisted(() => ({
  createApiOperationLog: vi.fn(),
}));

vi.mock("@/lib/api-operation-logs", () => ({
  createApiOperationLog,
  hashIp: (value: string | null) => value,
  limitLogJson: (value: unknown) => value,
  queryToJson: (value: unknown) => value,
  sanitizeLogPayload: (value: unknown) => value,
}));

import { POST } from "../route";

function ingestRequest(headerValue: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (headerValue !== null) {
    headers["x-operation-log-ingest-secret"] = headerValue;
  }

  return new Request("http://localhost/api/internal/operation-logs", {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
}

describe("POST /api/internal/operation-logs", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    createApiOperationLog.mockResolvedValue(undefined);
    process.env = { ...originalEnv, NODE_ENV: "test" };
    delete process.env.OPERATION_LOG_INGEST_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("rejects requests with a wrong ingest secret", async () => {
    process.env.OPERATION_LOG_INGEST_SECRET = "ingest-secret";

    const response = await POST(ingestRequest("wrong"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
    expect(createApiOperationLog).not.toHaveBeenCalled();
  });

  test("returns 503 in production when the ingest secret is not configured", async () => {
    process.env = { ...originalEnv, NODE_ENV: "production" };

    const response = await POST(ingestRequest("anything"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: "Internal service secret is not configured" });
    expect(createApiOperationLog).not.toHaveBeenCalled();
  });

  test("accepts the dev fallback secret outside production and records the log", async () => {
    const response = await POST(ingestRequest("development-operation-log-ingest"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true });
    expect(createApiOperationLog).toHaveBeenCalledTimes(1);
  });

  test("accepts the dedicated secret and records the log", async () => {
    process.env.OPERATION_LOG_INGEST_SECRET = "ingest-secret";

    const response = await POST(ingestRequest("ingest-secret"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true });
    expect(createApiOperationLog).toHaveBeenCalledTimes(1);
  });
});
