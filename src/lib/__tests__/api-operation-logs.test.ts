import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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
  NotFoundError,
  toErrorResponse,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/api-errors";
import {
  createApiOperationLog,
  getClientIpFromHeaders,
  hashIp,
  listApiOperationLogs,
  queryToJson,
  resetIpHashProdWarningForTests,
  sanitizeLogPayload,
} from "@/lib/api-operation-logs";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";

describe("api operation logs", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetIpHashProdWarningForTests();
    process.env = { ...originalEnv };
    delete process.env.API_OPERATION_LOG_TEST_ENABLE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("redacts secrets while preserving reported usage counters", () => {
    expect(sanitizeLogPayload({
      usage: {
        prompt_tokens: 900,
        completion_tokens: 120,
        reasoning_tokens: 80,
        prompt_cache_hit_tokens: 75,
      },
      api_key_fingerprint: "sha256-value",
      authorization: "Bearer secret",
      content: "prompt and article content",
    })).toEqual({
      usage: { prompt_tokens: 900, completion_tokens: 120, reasoning_tokens: 80, prompt_cache_hit_tokens: 75 },
      api_key_fingerprint: "[REDACTED]",
      authorization: "[REDACTED]",
      content: "[REDACTED]",
    });
  });

  test("redacts sensitive query params including OAuth callback parameters and scrubs URL values", () => {
    const params = new URLSearchParams(
      "q=posts&token=abc&code=gho_secret&state=csrf_123&oauth_token=ot_1&oauth_verifier=ov_1&id_token=idt_1&referrer=https%3A%2F%2Fuser%3Apass%40site.example%2Fcb%3Fapi_key%3Dsk-1%26tab%3Dprofile&tag=next&tag=prisma",
    );

    expect(queryToJson(params)).toEqual({
      q: "posts",
      token: "[REDACTED]",
      code: "[REDACTED]",
      state: "[REDACTED]",
      oauth_token: "[REDACTED]",
      oauth_verifier: "[REDACTED]",
      id_token: "[REDACTED]",
      referrer: "https://site.example/cb?api_key=[REDACTED]&tab=profile",
      tag: ["next", "prisma"],
    });
  });

  test("scrubs embedded URL credentials and sensitive query values in sanitizeLogPayload while preserving safe URL structure", () => {
    const sanitized = sanitizeLogPayload({
      url: "https://rss-user:rss-pass@feeds.example.com:8443/private/feed.xml?token=sec_tok&key=k1&secret=s1&password=p1&code=c1&state=st1&sig=sg1&signature=sig2&access_token=at1&api_key=ak1&apikey=ak2&auth=au1&category=ai&author=alice",
      referrer: "http://example.com/articles/1?utm_source=newsletter",
      note: "Upstream failed at https://u:p@api.example.com/v1/rss?token=xyz123&format=xml.",
    });

    expect(sanitized).toEqual({
      url: "https://feeds.example.com:8443/private/feed.xml?token=[REDACTED]&key=[REDACTED]&secret=[REDACTED]&password=[REDACTED]&code=[REDACTED]&state=[REDACTED]&sig=[REDACTED]&signature=[REDACTED]&access_token=[REDACTED]&api_key=[REDACTED]&apikey=[REDACTED]&auth=[REDACTED]&category=ai&author=alice",
      referrer: "http://example.com/articles/1?utm_source=newsletter",
      note: "Upstream failed at https://api.example.com/v1/rss?token=[REDACTED]&format=xml.",
    });
  });

  test("omits query logging when captureQuery is false (including /api/auth/[...nextauth])", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    process.env.NEXTAUTH_SECRET = "audit-log-hmac-secret";
    prismaMocks.create.mockResolvedValue({ id: "log-auth" });

    const handler = withApiOperationLogging(
      async () => new Response(null, { status: 302, headers: { location: "/" } }),
      {
        scope: "auth",
        operation: "auth.nextauth",
        route: "/api/auth/[...nextauth]",
        captureQuery: false,
        captureRequestBody: false,
      },
    );

    await handler(
      new Request("http://localhost/api/auth/callback/github?code=gho_live_secret&state=oauth_state_secret"),
    );

    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "auth",
        operation: "auth.nextauth",
        query: undefined,
        requestBody: undefined,
      }),
    });
    expect(JSON.stringify(prismaMocks.create.mock.calls[0])).not.toContain("gho_live_secret");
    expect(JSON.stringify(prismaMocks.create.mock.calls[0])).not.toContain("oauth_state_secret");

    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const nextAuthRouteSource = readFileSync(
      join(process.cwd(), "src/app/api/auth/[...nextauth]/route.ts"),
      "utf8",
    );
    expect(nextAuthRouteSource).toContain("captureQuery: false");
    expect(nextAuthRouteSource).toContain("captureRequestBody: false");
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

  test("prioritizes x-real-ip over spoofed x-forwarded-for and hashes IPs with HMAC-SHA256", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.99, 198.51.100.42",
      "x-real-ip": " 198.51.100.42 ",
    });
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.42");

    const xffOnlyHeaders = new Headers({
      "x-forwarded-for": " 203.0.113.99 , 10.0.0.2 ",
      "x-real-ip": "   ",
    });
    expect(getClientIpFromHeaders(xffOnlyHeaders)).toBe("203.0.113.99");
    expect(getClientIpFromHeaders(new Headers())).toBeNull();

    expect(hashIp(null)).toBeNull();
    expect(hashIp("")).toBeNull();

    process.env.NEXTAUTH_SECRET = "secret-alpha-for-hmac-test";
    const digestAlpha = hashIp("198.51.100.42");
    const unsaltedSha256 = createHash("sha256").update("198.51.100.42").digest("hex");

    expect(digestAlpha).toMatch(/^[0-9a-f]{64}$/);
    expect(digestAlpha).not.toBe(unsaltedSha256);

    process.env.NEXTAUTH_SECRET = "secret-beta-for-hmac-test";
    const digestBeta = hashIp("198.51.100.42");
    expect(digestBeta).toMatch(/^[0-9a-f]{64}$/);
    expect(digestBeta).not.toBe(digestAlpha);

    // Production without valid AUTH_SECRET / NEXTAUTH_SECRET must warn once and return null (never dev fallback)
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env = { ...originalEnv, NODE_ENV: "production" };
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;

    expect(hashIp("198.51.100.42")).toBeNull();
    expect(hashIp("203.0.113.99")).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Placeholder secret in production also fails closed to null
    process.env.NEXTAUTH_SECRET = "replace-with-strong-secret";
    expect(hashIp("198.51.100.42")).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Configured production secret resumes HMAC hashing
    process.env.NEXTAUTH_SECRET = "prod-real-hmac-secret";
    expect(hashIp("198.51.100.42")).toMatch(/^[0-9a-f]{64}$/);
    warnSpy.mockRestore();
  });

  test("blocks malformed JSON plaintext secrets, returns 400 Invalid JSON payload, and persists HMAC ipHash", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    process.env.NEXTAUTH_SECRET = "audit-log-hmac-secret";
    prismaMocks.create.mockResolvedValueOnce({ id: "log-malformed" });

    const handler = withApiOperationLogging(
      async (request: Request) => {
        try {
          await request.json();
          return Response.json({ ok: true });
        } catch (error) {
          return toErrorResponse(error);
        }
      },
      { scope: "admin", operation: "admin.models.create", route: "/api/admin/ai/models" },
    );

    const rawMalformedBody = '{"password":"secret-pass","apiKey":"sk-secret"';
    const response = await handler(
      new Request("http://localhost/api/admin/ai/models", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.99",
          "x-real-ip": "198.51.100.42",
        },
        body: rawMalformedBody,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });

    expect(prismaMocks.create).toHaveBeenCalledTimes(1);
    const loggedArgs = prismaMocks.create.mock.calls[0]?.[0];
    const serializedLog = JSON.stringify(loggedArgs);

    expect(serializedLog).not.toContain("secret-pass");
    expect(serializedLog).not.toContain("sk-secret");
    expect(loggedArgs).toEqual({
      data: expect.objectContaining({
        statusCode: 400,
        success: false,
        ipHash: hashIp("198.51.100.42"),
        requestBody: {
          malformedJson: true,
          byteLength: Buffer.byteLength(rawMalformedBody, "utf8"),
        },
        errorName: "SyntaxError",
        errorMessage: "Invalid JSON payload",
      }),
    });
    expect(loggedArgs.data.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(loggedArgs.data.requestBody).not.toHaveProperty("preview");
  });

  test("records errorName, scrubbed errorMessage, and HMAC ipHash across handled 400/401/404/429/500 responses", async () => {
    process.env.API_OPERATION_LOG_TEST_ENABLE = "1";
    process.env.NEXTAUTH_SECRET = "audit-log-hmac-secret";
    prismaMocks.create.mockResolvedValue({ id: "log-entry" });

    const cases: Array<{
      error: unknown;
      expectedStatus: number;
      expectedHttpError: string;
      expectedErrorName: string;
      expectedLoggedMessage?: string;
    }> = [
      {
        error: new ValidationError("Title is required"),
        expectedStatus: 400,
        expectedHttpError: "Title is required",
        expectedErrorName: "ValidationError",
        expectedLoggedMessage: "Title is required",
      },
      {
        error: new UnauthorizedError(),
        expectedStatus: 401,
        expectedHttpError: "Unauthorized",
        expectedErrorName: "UnauthorizedError",
        expectedLoggedMessage: "Unauthorized",
      },
      {
        error: Object.assign(new Error("Record to update not found"), {
          name: "PrismaClientKnownRequestError",
          code: "P2025",
        }),
        expectedStatus: 404,
        expectedHttpError: "Resource not found",
        expectedErrorName: "PrismaClientKnownRequestError",
        expectedLoggedMessage: "Resource not found",
      },
      {
        error: new NotFoundError("Post not found"),
        expectedStatus: 404,
        expectedHttpError: "Post not found",
        expectedErrorName: "NotFoundError",
        expectedLoggedMessage: "Post not found",
      },
      {
        error: new TooManyRequestsError(),
        expectedStatus: 429,
        expectedHttpError: "Too many requests",
        expectedErrorName: "TooManyRequestsError",
        expectedLoggedMessage: "Too many requests",
      },
      {
        error: new TypeError(
          'Query failed on postgresql://admin:secret-pass@10.0.0.5:5432/inkforge with Authorization: Bearer sk-secret and {"password":"secret-pass","apiKey":"sk-secret"} VALUES (\'secret-pass\')',
        ),
        expectedStatus: 500,
        expectedHttpError: "Safe fallback message",
        expectedErrorName: "TypeError",
      },
    ];

    for (const testCase of cases) {
      prismaMocks.create.mockClear();
      const handler = withApiOperationLogging(
        async () => {
          try {
            throw testCase.error;
          } catch (error) {
            return toErrorResponse(error, "Safe fallback message");
          }
        },
        { scope: "admin", operation: "admin.test.run", route: "/api/admin/test" },
      );

      const response = await handler(
        new Request("http://localhost/api/admin/test", {
          method: "POST",
          headers: { "x-real-ip": "198.51.100.77" },
        }),
      );

      expect(response.status).toBe(testCase.expectedStatus);
      await expect(response.json()).resolves.toEqual({ error: testCase.expectedHttpError });

      const loggedData = prismaMocks.create.mock.calls[0]?.[0]?.data;
      expect(loggedData).toEqual(
        expect.objectContaining({
          statusCode: testCase.expectedStatus,
          success: false,
          ipHash: hashIp("198.51.100.77"),
          errorName: testCase.expectedErrorName,
        }),
      );
      expect(loggedData.ipHash).toMatch(/^[0-9a-f]{64}$/);
      expect(typeof loggedData.errorMessage).toBe("string");
      expect(loggedData.errorMessage.length).toBeGreaterThan(0);

      if (testCase.expectedLoggedMessage) {
        expect(loggedData.errorMessage).toBe(testCase.expectedLoggedMessage);
      } else {
        expect(loggedData.errorMessage).not.toContain("secret-pass");
        expect(loggedData.errorMessage).not.toContain("sk-secret");
      }
    }
  });
});
