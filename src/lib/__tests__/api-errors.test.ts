import { describe, expect, test } from "vitest";

import {
  getPrismaConflictMessage,
  getPrismaConflictTarget,
  isDatabaseConnectionError,
  toErrorResponse,
} from "../api-errors";

describe("api error responses", () => {
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
});
