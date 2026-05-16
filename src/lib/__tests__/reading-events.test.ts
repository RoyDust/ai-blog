import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  postFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: prismaMocks.postFindFirst,
    },
    $executeRaw: prismaMocks.executeRaw,
  },
}));

import { recordQualifiedReadingEvent } from "@/lib/reading-events";

describe("reading events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.postFindFirst.mockResolvedValue({ id: "post-1" });
    prismaMocks.executeRaw.mockResolvedValue(1);
  });

  test("rejects events that do not meet qualified reading thresholds", async () => {
    await expect(
      recordQualifiedReadingEvent({
        userId: "user-1",
        postId: "post-1",
        durationSeconds: 5,
        scrollDepth: 10,
        now: new Date("2026-05-16T12:00:00Z"),
      }),
    ).rejects.toThrow("有效阅读条件不足");

    expect(prismaMocks.postFindFirst).not.toHaveBeenCalled();
    expect(prismaMocks.executeRaw).not.toHaveBeenCalled();
  });

  test("rejects missing or unpublished posts", async () => {
    prismaMocks.postFindFirst.mockResolvedValueOnce(null);

    await expect(
      recordQualifiedReadingEvent({
        userId: "user-1",
        postId: "missing-post",
        durationSeconds: 20,
        scrollDepth: 0,
        now: new Date("2026-05-16T12:00:00Z"),
      }),
    ).rejects.toThrow("Post not found");

    expect(prismaMocks.postFindFirst).toHaveBeenCalledWith({
      where: {
        id: "missing-post",
        deletedAt: null,
        published: true,
      },
      select: { id: true },
    });
    expect(prismaMocks.executeRaw).not.toHaveBeenCalled();
  });

  test("upserts a qualified reading event with normalized values", async () => {
    await expect(
      recordQualifiedReadingEvent({
        userId: "user-1",
        postId: "post-1",
        durationSeconds: 20.8,
        scrollDepth: 41.2,
        now: new Date("2026-05-16T12:00:00Z"),
      }),
    ).resolves.toMatchObject({
      postId: "post-1",
      durationSeconds: 20,
      scrollDepth: 41,
      readDate: new Date("2026-05-16T00:00:00Z"),
    });

    expect(prismaMocks.executeRaw).toHaveBeenCalledOnce();
    expect(String(prismaMocks.executeRaw.mock.calls[0][0])).toContain("ON CONFLICT");
  });
});
