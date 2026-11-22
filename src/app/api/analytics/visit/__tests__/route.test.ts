import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { hashIp } from "@/lib/api-operation-logs";

const { findFirstPost, createVisitLogOperation, readSessionUserId, postUpdate } = vi.hoisted(() => ({
  findFirstPost: vi.fn(),
  createVisitLogOperation: vi.fn(),
  readSessionUserId: vi.fn(),
  postUpdate: vi.fn(),
}));
const writeOrder: string[] = [];

vi.mock("@/lib/visit-log-repository", () => ({
  createVisitLogOperation,
}));

vi.mock("@/lib/session-token", () => ({
  readSessionUserId,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: findFirstPost,
      update: postUpdate,
    },
  },
}));

describe("POST /api/analytics/visit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeOrder.length = 0;
    readSessionUserId.mockResolvedValue(null);
    createVisitLogOperation.mockImplementation(async () => {
      writeOrder.push("create-visit");
    });
    postUpdate.mockImplementation(async () => {
      writeOrder.push("update-post");
    });
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
    expect(writeOrder).toEqual(["create-visit"]);
    expect(postUpdate).not.toHaveBeenCalled();
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
    expect(writeOrder).toEqual(["create-visit", "update-post"]);
  });

  test("attaches the user id decoded from the session cookie without a session lookup", async () => {
    readSessionUserId.mockResolvedValueOnce("user-1");
    findFirstPost.mockResolvedValueOnce({ id: "post-1" });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/posts/hello-world", visitorId: "visitor-1" }),
    }));

    expect(response.status).toBe(200);
    expect(readSessionUserId).toHaveBeenCalledTimes(1);
    expect(createVisitLogOperation).toHaveBeenCalledWith(expect.objectContaining({
      postId: "post-1",
      userId: "user-1",
    }));
  });

  test("does not resolve a full NextAuth session on the visit write path", () => {
    const source = readFileSync(path.join(__dirname, "..", "route.ts"), "utf8");

    expect(source).not.toContain("getServerSession");
    expect(source).not.toContain("$transaction");
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
    expect(postUpdate).not.toHaveBeenCalled();
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

  test("prioritizes x-real-ip over spoofed x-forwarded-for and uses HMAC ipHash", async () => {
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.99",
        "x-real-ip": "198.51.100.55",
      },
      body: JSON.stringify({ path: "/about" }),
    }));

    expect(response.status).toBe(200);
    const unsaltedRealIp = createHash("sha256").update("198.51.100.55").digest("hex");
    expect(createVisitLogOperation).toHaveBeenCalledWith(expect.objectContaining({
      ipHash: hashIp("198.51.100.55"),
    }));
    expect(hashIp("198.51.100.55")).not.toBe(unsaltedRealIp);
    expect(hashIp("198.51.100.55")).not.toBe(hashIp("203.0.113.99"));
  });

  test("scrubs query strings, hashes, and unsafe schemes from referrer so magic-link tokens are never stored", async () => {
    const { POST } = await import("../route");

    const sameOriginResponse = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.88" },
      body: JSON.stringify({
        path: "/posts/hello-world",
        referrer: "https://inkforge.example/newsletter/verify?token=secret-magic-token&email=a@b.com#confirmed",
        visitorId: "visitor-scrub-1",
      }),
    }));
    expect(sameOriginResponse.status).toBe(200);
    expect(createVisitLogOperation).toHaveBeenLastCalledWith(expect.objectContaining({
      referrer: "https://inkforge.example/newsletter/verify",
    }));

    const unsafeSchemeResponse = await POST(new Request("http://localhost/api/analytics/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.89" },
      body: JSON.stringify({
        path: "/about",
        referrer: "javascript:alert('secret')",
        visitorId: "visitor-scrub-2",
      }),
    }));
    expect(unsafeSchemeResponse.status).toBe(200);
    expect(createVisitLogOperation).toHaveBeenLastCalledWith(expect.objectContaining({
      referrer: null,
    }));
  });
});
