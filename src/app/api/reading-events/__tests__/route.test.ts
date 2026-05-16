import { beforeEach, describe, expect, test, vi } from "vitest";
import { UnauthorizedError } from "@/lib/api-errors";

const requireSession = vi.fn();
const checkInteractionRateLimit = vi.fn();
const recordQualifiedReadingEvent = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireSession,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkInteractionRateLimit,
}));

vi.mock("@/lib/reading-events", () => ({
  recordQualifiedReadingEvent,
}));

describe("POST /api/reading-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ user: { id: "user-1" } });
    checkInteractionRateLimit.mockResolvedValue({ allowed: true });
    recordQualifiedReadingEvent.mockResolvedValue({
      postId: "post-1",
      durationSeconds: 20,
      scrollDepth: 35,
    });
  });

  test("requires a logged-in user", async () => {
    requireSession.mockRejectedValueOnce(new UnauthorizedError());

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/reading-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1", durationSeconds: 20, scrollDepth: 0 }),
    }));

    expect(response.status).toBe(401);
    expect(recordQualifiedReadingEvent).not.toHaveBeenCalled();
  });

  test("rejects missing post ids", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/reading-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds: 20, scrollDepth: 0 }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Valid postId is required" });
    expect(recordQualifiedReadingEvent).not.toHaveBeenCalled();
  });

  test("records qualified reading events for the current user", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/reading-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1", durationSeconds: 20, scrollDepth: 35 }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      recorded: true,
      data: {
        postId: "post-1",
        durationSeconds: 20,
        scrollDepth: 35,
      },
    });
    expect(recordQualifiedReadingEvent).toHaveBeenCalledWith({
      userId: "user-1",
      postId: "post-1",
      durationSeconds: 20,
      scrollDepth: 35,
    });
  });

  test("rate-limits repeated reading event writes", async () => {
    checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/reading-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: "post-1", durationSeconds: 20, scrollDepth: 0 }),
    }));

    expect(response.status).toBe(429);
    expect(recordQualifiedReadingEvent).not.toHaveBeenCalled();
  });
});
