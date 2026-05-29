import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  create: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiOperationLog: prismaMocks,
  },
}));

import {
  createApiOperationLog,
  listApiOperationLogs,
  queryToJson,
  sanitizeLogPayload,
} from "@/lib/api-operation-logs";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";

describe("api operation logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.API_OPERATION_LOG_TEST_ENABLE;
  });

  test("redacts sensitive keys recursively", () => {
    expect(sanitizeLogPayload({
      email: "admin@example.com",
      password: "secret",
      nested: {
        apiKey: "key-1",
        content: "long article body",
      },
    })).toEqual({
      email: "admin@example.com",
      password: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        content: "[REDACTED]",
      },
    });
  });

  test("redacts sensitive query params", () => {
    const params = new URLSearchParams("q=posts&token=abc&tag=next&tag=prisma");

    expect(queryToJson(params)).toEqual({
      q: "posts",
      token: "[REDACTED]",
      tag: ["next", "prisma"],
    });
  });

  test("skips writes in tests unless explicitly enabled", async () => {
    await createApiOperationLog({
      method: "GET",
      path: "/api/admin/posts",
      scope: "admin",
      success: true,
    });

    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  test("writes sanitized log data when test logging is enabled", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    prismaMocks.create.mockResolvedValueOnce({ id: "log-1" });

    await createApiOperationLog({
      requestId: "req-1",
      method: "POST",
      path: "/api/admin/posts",
      scope: "admin",
      success: true,
      requestBody: { title: "Hello", password: "[REDACTED]" },
    });

    expect(prismaMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestId: "req-1",
        method: "POST",
        path: "/api/admin/posts",
        scope: "admin",
        success: true,
      }),
    }));
  });

  test("does not capture oversized json request bodies", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    prismaMocks.create.mockResolvedValueOnce({ id: "log-1" });
    const body = JSON.stringify({ title: "Big", content: "x".repeat(9_000) });
    const handler = withApiOperationLogging(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
      { scope: "admin", operation: "admin.big.create", route: "/api/admin/big" },
    );

    await handler(new Request("http://localhost/api/admin/big", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(body.length),
      },
      body,
    }));

    expect(prismaMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        requestBody: undefined,
      }),
    }));
  });

  test("preserves responses with immutable headers", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    prismaMocks.create.mockResolvedValueOnce({ id: "log-1" });
    const originalResponse = new Response("ok", { status: 201 });
    vi.spyOn(originalResponse.headers, "set").mockImplementation(() => {
      throw new Error("immutable headers");
    });
    const handler = withApiOperationLogging(
      async () => originalResponse,
      { scope: "admin", operation: "admin.immutable.create", route: "/api/admin/immutable" },
    );

    const response = await handler(new Request("http://localhost/api/admin/immutable"));

    expect(response).toBe(originalResponse);
    expect(response.status).toBe(201);
    await expect(response.text()).resolves.toBe("ok");
  });

  test("lists logs with default self-log filtering", async () => {
    prismaMocks.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prismaMocks.findMany.mockResolvedValueOnce([{ id: "log-1" }, { id: "log-2" }]);

    const result = await listApiOperationLogs({ range: "7", limit: "1" });

    expect(result.items).toEqual([{ id: "log-1" }]);
    expect(result.nextCursor).toBe("log-1");
    expect(result.summary).toEqual({ totalCount: 2, failedCount: 1, successCount: 1 });
    expect(prismaMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({
            NOT: expect.arrayContaining([
              { path: { startsWith: "/api/admin/logs" } },
            ]),
          }),
        ]),
      }),
    }));
  });

  test("clamps page-based log lists to the last page", async () => {
    prismaMocks.count.mockResolvedValueOnce(45).mockResolvedValueOnce(5);
    prismaMocks.findMany.mockResolvedValueOnce([{ id: "log-41" }]);

    const result = await listApiOperationLogs({ range: "7", limit: "20", page: "999" });

    expect(prismaMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 40,
      take: 20,
    }));
    expect(result.pagination).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
    expect(result.nextCursor).toBeNull();
  });
});
