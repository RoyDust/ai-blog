import { beforeEach, describe, expect, test, vi } from "vitest";

const findFirstPost = vi.fn();
const createVisitLogOperation = vi.fn();
const getServerSession = vi.fn();
const postUpdate = vi.fn();
const transaction = vi.fn(async (operations: unknown[]) => operations);

vi.mock("@/lib/visit-log-repository", () => ({
  createVisitLogOperation,
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: findFirstPost,
      update: postUpdate,
    },
    $transaction: transaction,
  },
}));

describe("POST /api/analytics/visit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue(null);
    createVisitLogOperation.mockReturnValue({ kind: "create-visit" });
    postUpdate.mockReturnValue({ kind: "update-post" });
  });

  test("writes a normal page visit", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      body: JSON.stringify({ path: "/about", referrer: "https://example.com", visitorId: "visitor-1" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(findFirstPost).not.toHaveBeenCalled();
    expect(createVisitLogOperation).toHaveBeenCalledWith(expect.objectContaining({
      path: "/about",
      postId: null,
      userId: null,
      referrer: "https://example.com",
      visitorId: "visitor-1",
      userAgent: "vitest",
      ipHash: expect.any(String),
    }));
    expect(transaction).toHaveBeenCalledWith([{ kind: "create-visit" }]);
  });

  test("links post visits and increments post view count", async () => {
    findFirstPost.mockResolvedValueOnce({ id: "post-1" });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/posts/hello-world", visitorId: "visitor-1" }),
    }));

    expect(response.status).toBe(200);
    expect(findFirstPost).toHaveBeenCalledWith({
      where: { slug: "hello-world", deletedAt: null, published: true },
      select: { id: true },
    });
    expect(createVisitLogOperation).toHaveBeenCalledWith(expect.objectContaining({ path: "/posts/hello-world", postId: "post-1" }));
    expect(postUpdate).toHaveBeenCalledWith({ where: { id: "post-1" }, data: { viewCount: { increment: 1 } } });
    expect(transaction).toHaveBeenCalledWith([{ kind: "create-visit" }, { kind: "update-post" }]);
  });

  test("attaches logged-in user id to post visit logs", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    findFirstPost.mockResolvedValueOnce({ id: "post-1" });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/posts/hello-world", visitorId: "visitor-1" }),
    }));

    expect(response.status).toBe(200);
    expect(createVisitLogOperation).toHaveBeenCalledWith(expect.objectContaining({
      postId: "post-1",
      userId: "user-1",
    }));
  });

  test("skips excluded paths", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/admin" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, skipped: true });
    expect(createVisitLogOperation).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  test("rejects invalid paths", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "https://evil.example/path" }),
    }));

    expect(response.status).toBe(400);
    expect(createVisitLogOperation).not.toHaveBeenCalled();
  });

  test("rate-limits repeated public visit writes by client ip", async () => {
    const { POST } = await import("../route");
    const responses = [];

    for (let index = 0; index < 31; index += 1) {
      responses.push(
        await POST(new Request("http://localhost/api/analytics/visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "198.51.100.23",
          },
          body: JSON.stringify({ path: `/about?hit=${index}` }),
        })),
      );
    }

    expect(responses.slice(0, 30).map((response) => response.status)).toEqual(Array(30).fill(200));
    expect(responses[30].status).toBe(429);
    expect(await responses[30].json()).toEqual({ error: "Too many analytics requests" });
  });
});
