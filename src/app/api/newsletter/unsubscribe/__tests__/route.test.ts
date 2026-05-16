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

vi.mock("@/lib/newsletter", () => ({
  unsubscribe: mocks.unsubscribe,
}));

describe("POST /api/newsletter/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkInteractionRateLimit.mockResolvedValue({ allowed: true });
    mocks.unsubscribe.mockResolvedValue({ id: "sub-1" });
  });

  test("unsubscribes by token", async () => {
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
