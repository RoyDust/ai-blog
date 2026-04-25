import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const prismaMocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateManyMock: vi.fn(),
  updateMock: vi.fn(),
  aiFindManyMock: vi.fn(),
  aiFindUniqueMock: vi.fn(),
  aiCountMock: vi.fn(),
  aiTaskCreateMock: vi.fn(),
  revalidatePublicContentMock: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent: prismaMocks.revalidatePublicContentMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: prismaMocks.findManyMock,
      updateMany: prismaMocks.updateManyMock,
      update: prismaMocks.updateMock,
    },
    aiModel: {
      findMany: prismaMocks.aiFindManyMock,
      findUnique: prismaMocks.aiFindUniqueMock,
      count: prismaMocks.aiCountMock,
    },
    aiTask: {
      create: prismaMocks.aiTaskCreateMock,
    },
  },
}));

describe("admin bulk post summarize route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    prismaMocks.aiFindManyMock.mockResolvedValue([]);
    prismaMocks.aiFindUniqueMock.mockResolvedValue(null);
    prismaMocks.aiCountMock.mockResolvedValue(0);
    prismaMocks.aiTaskCreateMock.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "task-1",
        ...data,
        items: data.items?.create?.map((item: Record<string, unknown>, index: number) => ({ id: `item-${index + 1}`, ...item })) ?? [],
      }),
    );
    prismaMocks.updateManyMock.mockResolvedValue({ count: 0 });
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-api-key",
      DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      DASHSCOPE_MODEL: "qwen3.5-flash",
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  test("rejects non-admin requests", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/summarize/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["post-1"] }),
      }),
    );

    expect(response.status).toBe(401);
  });

  test("queues selected posts for asynchronous summary generation", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);
    prismaMocks.findManyMock.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "第一篇",
        content: "第一篇正文",
      },
      {
        id: "post-2",
        title: "第二篇",
        content: "第二篇正文",
      },
    ]);
    prismaMocks.updateManyMock.mockResolvedValueOnce({ count: 2 });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/summarize/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["post-1", "post-2"] }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(prismaMocks.updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["post-1", "post-2"] }, deletedAt: null },
      data: expect.objectContaining({
        summaryStatus: "QUEUED",
        summaryError: null,
        summaryModelId: "post-summary-openai-compatible",
      }),
    }));
    expect(prismaMocks.updateMock).not.toHaveBeenCalled();
    expect(prismaMocks.revalidatePublicContentMock).not.toHaveBeenCalled();
    expect(data).toMatchObject({
      success: true,
      data: {
        requested: 2,
        queued: 2,
        failed: 0,
        status: "queued",
      },
    });
    expect(data.data.jobId).toEqual(expect.any(String));
  });

  test("reports missing posts without aborting the whole batch", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);
    prismaMocks.findManyMock.mockResolvedValueOnce([]);

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/posts/summarize/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["missing-post"] }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(202);
    expect(data).toMatchObject({
      success: true,
      data: {
        queued: 0,
        failed: 1,
        status: "finished",
        results: [{ id: "missing-post", status: "failed", error: "Post not found" }],
      },
    });
  });

  test("returns current job status and resumes active jobs", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);
    prismaMocks.findManyMock
      .mockResolvedValueOnce([{ summaryJobId: "job-1", summaryModelId: "post-summary-openai-compatible" }])
      .mockResolvedValueOnce([
        {
          id: "post-1",
          title: "第一篇",
          excerpt: null,
          summaryStatus: "GENERATING",
          summaryError: null,
          summaryGeneratedAt: null,
          summaryJobId: "job-1",
        },
      ]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/posts/summarize/bulk?resume=1"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      data: {
        active: true,
        counts: { GENERATING: 1 },
        posts: [{ id: "post-1", summaryStatus: "GENERATING", summaryJobId: "job-1" }],
      },
    });
  });
});
