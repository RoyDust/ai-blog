import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateManyMock: vi.fn(),
  updateMock: vi.fn(),
  aiFindManyMock: vi.fn(),
  aiFindUniqueMock: vi.fn(),
  aiCountMock: vi.fn(),
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
  },
}));

describe("post summary jobs", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    prismaMocks.aiFindManyMock.mockResolvedValue([]);
    prismaMocks.aiFindUniqueMock.mockResolvedValue(null);
    prismaMocks.aiCountMock.mockResolvedValue(0);
    prismaMocks.updateManyMock.mockResolvedValue({ count: 1 });
    prismaMocks.updateMock.mockResolvedValue({ id: "post-1" });
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-api-key",
      DASHSCOPE_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      DASHSCOPE_MODEL: "qwen3.5-flash",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("runs a queued summary job and stores generated excerpts", async () => {
    prismaMocks.findManyMock.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "第一篇",
        content: "第一篇正文",
        slug: "post-one",
        category: { slug: "tech" },
        tags: [{ slug: "ai" }],
      },
    ]);
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "生成后的文章摘要。" } }],
      }),
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const { runPostSummaryJob } = await import("@/lib/post-summary-jobs");
    await runPostSummaryJob("job-1", "post-summary-openai-compatible");

    expect(prismaMocks.updateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "post-1",
        summaryJobId: "job-1",
      }),
      data: expect.objectContaining({
        summaryStatus: "GENERATING",
        summaryError: null,
      }),
    }));
    expect(prismaMocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "post-1" },
      data: expect.objectContaining({
        excerpt: "生成后的文章摘要。",
        summaryStatus: "GENERATED",
        summaryError: null,
        summaryModelId: "post-summary-openai-compatible",
      }),
    }));
    expect(prismaMocks.revalidatePublicContentMock).toHaveBeenCalledWith({
      slug: "post-one",
      categorySlug: "tech",
      tagSlugs: ["ai"],
    });
  });
});
