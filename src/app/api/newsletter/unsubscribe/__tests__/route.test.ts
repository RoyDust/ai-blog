import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkInteractionRateLimit: vi.fn(),
  unsubscribe: vi.fn(),
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
    unsubscribe: mocks.unsubscribe,
  };
});

describe("/api/newsletter/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkInteractionRateLimit.mockResolvedValue({ allowed: true });
    mocks.unsubscribe.mockResolvedValue({ id: "sub-1" });
  });

  test("GET redirects to the public unsubscribe confirmation page without mutating DB", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("https://blog.example/api/newsletter/unsubscribe?token=u.123"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://blog.example/newsletter/unsubscribe?token=u.123");
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  test("POST unsubscribes by JSON token", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "unsubscribe-token" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { unsubscribed: true } });
    expect(mocks.unsubscribe).toHaveBeenCalledWith("unsubscribe-token");
  });

  test("POST supports RFC 8058 One-Click Unsubscribe with List-Unsubscribe=One-Click and URL query token", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/unsubscribe?token=u.oneclick.sig", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { unsubscribed: true } });
    expect(mocks.unsubscribe).toHaveBeenCalledWith("u.oneclick.sig");
  });

  test("POST supports application/x-www-form-urlencoded token in body", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://blog.example/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "token=u.form.sig&List-Unsubscribe=One-Click",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { unsubscribed: true } });
    expect(mocks.unsubscribe).toHaveBeenCalledWith("u.form.sig");
  });

  test("rejects raw email unsubscribe requests", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Token is required" });
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  test("rate limits unsubscribe attempts", async () => {
    mocks.checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "unsubscribe-token" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
});
