import { describe, expect, test } from "vitest";

import {
  getApiOperationLogContext,
  runApiOperationLogContext,
} from "../api-operation-log-context";
import {
  ApiError,
  getPrismaConflictMessage,
  getPrismaConflictTarget,
  isDatabaseConnectionError,
  ServiceUnavailableError,
  toErrorResponse,
  TooManyRequestsError,
  UpstreamError,
  ValidationError,
} from "../api-errors";

describe("api error responses", () => {
  test("maps rate limit, upstream and unavailable errors to their status codes", async () => {
    const cases: Array<[ApiError, number, string]> = [
      [new TooManyRequestsError(), 429, "Too many requests"],
      [new TooManyRequestsError("Too many analytics requests"), 429, "Too many analytics requests"],
      [new UpstreamError("Summary generation failed"), 502, "Summary generation failed"],
      [new ServiceUnavailableError("Internal service secret is not configured"), 503, "Internal service secret is not configured"],
    ];

    for (const [error, status, message] of cases) {
      const response = toErrorResponse(error);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: message });
    }
  });

  test("maps transient database connection failures to a retryable 503", async () => {
    const response = toErrorResponse(new Error("Connection terminated unexpectedly"));

    await expect(response.json()).resolves.toEqual({
      error: "Database connection failed. Please retry shortly.",
    });
    expect(response.status).toBe(503);
  });

  test("detects common pg connection timeout errors", () => {
    expect(isDatabaseConnectionError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isDatabaseConnectionError(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isDatabaseConnectionError({ code: "ECONNRESET", message: "socket hang up" })).toBe(true);
    expect(isDatabaseConnectionError(new Error("some business error"))).toBe(false);
  });

  test("extracts conflict target fields from Prisma P2002 errors", () => {
    expect(getPrismaConflictTarget({ code: "P2002", meta: { target: ["slug"] } })).toEqual(["slug"]);
    expect(getPrismaConflictTarget({ code: "P2002", meta: { target: ["postId", "userId"] } })).toEqual(["postId", "userId"]);
    expect(getPrismaConflictTarget({ code: "P2002", meta: {} })).toEqual([]);
    expect(getPrismaConflictTarget({ code: "P2002" })).toEqual([]);
    expect(getPrismaConflictTarget(new Error("nope"))).toEqual([]);
  });

  test("extracts fields from Prisma 7 driver adapter constraint metadata", () => {
    // 真实库探针（2026-08-15）验证的形态：部分唯一索引触发的 P2002，
    // meta.target 为空，字段在 driverAdapterError.cause.constraint.fields。
    const error = {
      code: "P2002",
      meta: {
        modelName: "Post",
        driverAdapterError: {
          cause: { constraint: { fields: ["slug"] } },
        },
      },
    };
    expect(getPrismaConflictTarget(error)).toEqual(["slug"]);
    expect(getPrismaConflictMessage(error)).toBe("该 slug 已被使用，请更换后再试");
  });

  test("maps P2002 conflicts on readable fields to actionable messages", () => {
    expect(getPrismaConflictMessage({ code: "P2002", meta: { target: ["slug"] } })).toBe("该 slug 已被使用，请更换后再试");
    expect(getPrismaConflictMessage({ code: "P2002", meta: { target: ["name"] } })).toBe("该名称已被使用，请更换后再试");
    expect(getPrismaConflictMessage({ code: "P2002", meta: { target: ["url"] } })).toBe("该资源地址已存在");
    expect(getPrismaConflictMessage({ code: "P2002", meta: { target: ["postId", "userId"] } })).toBeNull();
  });

  test("falls back to parsing the constraint name in P2002 messages when target is missing", () => {
    // 部分唯一索引由迁移 SQL 手写创建，Prisma 可能无法反推 target 字段，
    // 错误消息里只带约束名。此时仍应给出可读文案。
    expect(getPrismaConflictMessage({
      code: "P2002",
      message: 'Unique constraint failed on the constraint: `posts_slug_active_unique`',
    })).toBe("该 slug 已被使用，请更换后再试");

    expect(getPrismaConflictMessage({
      code: "P2002",
      message: 'Unique constraint failed on the fields: (`name`)',
    })).toBe("该名称已被使用，请更换后再试");

    expect(getPrismaConflictMessage({
      code: "P2002",
      message: 'Unique constraint failed on the constraint: `postId_userId_key`',
    })).toBeNull();
  });

  test("turns readable P2002 conflicts into 409 with a friendly error", async () => {
    const response = toErrorResponse({ code: "P2002", meta: { target: ["slug"] } });

    await expect(response.json()).resolves.toEqual({ error: "该 slug 已被使用，请更换后再试" });
    expect(response.status).toBe(409);
  });

  test("keeps generic Conflict for P2002 without a readable target", async () => {
    const response = toErrorResponse({ code: "P2002", meta: { target: ["postId", "userId"] } });

    await expect(response.json()).resolves.toEqual({ error: "Conflict" });
    expect(response.status).toBe(409);
  });

  test("maps Prisma P2025 not-found errors to 404", async () => {
    const response = toErrorResponse({ code: "P2025", message: "An operation failed because it depends on one or more records that were required but not found." });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Resource not found" });
  });

  test("maps JSON parse SyntaxError to 400 Invalid JSON payload without echoing raw input", async () => {
    let parseError: unknown;
    try {
      JSON.parse('{"password":"secret-pass","apiKey":"sk-secret"');
    } catch (error) {
      parseError = error;
    }

    const response = toErrorResponse(parseError);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
  });

  test("records handled errorName and scrubbed errorMessage in api-operation-log-context", async () => {
    await runApiOperationLogContext({ requestId: "req-400", scope: "admin" }, async () => {
      const response = toErrorResponse(new ValidationError("Bad input"));
      expect(response.status).toBe(400);
      expect(getApiOperationLogContext()?.error).toEqual({
        errorName: "ValidationError",
        errorMessage: "Bad input",
      });
    });

    await runApiOperationLogContext({ requestId: "req-500", scope: "admin" }, async () => {
      const response = toErrorResponse(
        new Error(
          "Upstream failed at https://user:secret-pass@api.example.com/v1?api_key=sk-secret with Bearer sk-secret",
        ),
        "Operation failed",
      );
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Operation failed" });

      const recorded = getApiOperationLogContext()?.error;
      expect(recorded?.errorName).toBe("Error");
      expect(recorded?.errorMessage).toContain("https://api.example.com/v1");
      expect(recorded?.errorMessage).not.toContain("secret-pass");
      expect(recorded?.errorMessage).not.toContain("sk-secret");
    });
  });
});
