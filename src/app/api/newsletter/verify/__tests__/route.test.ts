import { beforeEach, describe, expect, test, vi } from "vitest";

import { ValidationError } from "@/lib/api-errors";

const mocks = vi.hoisted(() => ({
  checkInteractionRateLimit: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkInteractionRateLimit: mocks.checkInteractionRateLimit,
}));

vi.mock("@/lib/newsletter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/newsletter")>("@/lib/newsletter");

  return {
    ...actual,
    verify: mocks.verify,
  };
});

describe("/api/newsletter/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkInteractionRateLimit.mockResolvedValue({ allowed: true });
    mocks.verify.mockResolvedValue({
      id: "sub-1",
      email: "reader@example.com",
      status: "verified",
    });
  });

  test("GET redirects to the public confirmation page without mutating subscriber state", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("https://blog.example/api/newsletter/verify?token=verify-token-1"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://blog.example/newsletter/verify?token=verify-token-1");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  test("POST verifies subscriber by JSON token", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.20" },
        body: JSON.stringify({ token: "verify-token-1" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        verified: true,
        status: "verified",
      },
    });
    expect(mocks.checkInteractionRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledWith("verify-token-1");
  });

  test("POST rate limits verification attempts", async () => {
    mocks.checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "verify-token-1" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  test("POST rejects >48h expired verification tokens with 400 ValidationError", async () => {
    mocks.verify.mockRejectedValueOnce(new ValidationError("验证链接已过期，请重新提交订阅申请"));

    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "expired-token" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "验证链接已过期，请重新提交订阅申请" });
  });

  test("POST returns 404 when verification token does not match an active pending subscriber", async () => {
    mocks.verify.mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "unknown-token" }),
      }),
    );

    expect(response.status).toBe(404);
  });
});
