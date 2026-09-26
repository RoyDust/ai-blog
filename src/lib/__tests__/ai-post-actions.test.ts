import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiModelForCapability: vi.fn(),
  postUpdate: vi.fn(),
  postFindFirst: vi.fn(), postUpdateMany: vi.fn(), itemUpdateMany: vi.fn(),
  tagFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  getAiTaskItem: vi.fn(),
  markAiTaskItemSucceeded: vi.fn(),
  revalidatePublicContent: vi.fn(),
}));

vi.mock("@/lib/ai-models", () => ({
  getAiModelChatRequestExtras: vi.fn(() => ({})),
  getAiModelForCapability: mocks.getAiModelForCapability,
}));

vi.mock("@/lib/ai-tasks", () => ({
  AI_TASK_ITEM_STATUSES: {
    queued: "QUEUED",
    running: "RUNNING",
    succeeded: "SUCCEEDED",
    failed: "FAILED",
    skipped: "SKIPPED",
  },
  getAiTaskItem: mocks.getAiTaskItem,
  markAiTaskItemSucceeded: mocks.markAiTaskItemSucceeded,
  lockAiTask: vi.fn(async () => ({ id: "task-1", modelId: "model-1" })),
  isAiTaskActive: (status: string) => status === "RUNNING" || status === "QUEUED",
  refreshAiTaskCountsInTransaction: vi.fn(),
}));

vi.mock("@/lib/cache", async (original) => ({
  ...await original<typeof import("@/lib/cache")>(),
  revalidatePublicContentStrict: mocks.revalidatePublicContent,
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    $queryRawUnsafe: vi.fn(),
    aiTaskItem: { findUnique: mocks.getAiTaskItem, updateMany: mocks.itemUpdateMany },
    post: {
      update: mocks.postUpdate,
      findFirst: mocks.postFindFirst, updateMany: mocks.postUpdateMany,
    },
    tag: {
      findMany: mocks.tagFindMany,
    },
    category: {
      findMany: mocks.categoryFindMany,
    },
  };
  return { prisma: { ...client, $transaction: (fn: (tx: typeof client) => unknown) => fn(client) } };
});

const aiModel = {
  id: "model-1",
  name: "测试模型",
  description: "",
  provider: "openai-compatible",
  baseUrl: "https://compat.example/v1",
  requestPath: "/chat/completions",
  model: "qwen",
  apiKey: "secret",
  apiKeyEnv: "database",
  baseUrlEnv: "database",
  modelEnv: "database",
  capabilities: ["post-summary"],
  defaultFor: ["post-summary"],
  source: "database",
  editable: true,
  deletable: true,
  enabled: true,
  status: "ready",
  hasApiKey: true,
};

describe("ai post actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    mocks.getAiModelForCapability.mockResolvedValue(aiModel);
    mocks.postUpdateMany.mockResolvedValue({ count: 1 });
    mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.revalidatePublicContent.mockReturnValue({ paths: [], errors: [] });
    process.env.AI_POST_SUMMARY_TIMEOUT_MS = "90000";
  });

  test.each(["model", "tags", "category"])("classifies %s database read failures as recoverable infrastructure errors", async (dependency) => {
    const failure = new Error(dependency + " database unavailable");
    if (dependency === "model") mocks.getAiModelForCapability.mockRejectedValueOnce(failure);
    if (dependency === "tags") mocks.tagFindMany.mockRejectedValueOnce(failure);
    if (dependency === "category") mocks.categoryFindMany.mockRejectedValueOnce(failure);
    const { runPostAiAction } = await import("../ai-post-actions");
    await expect(runPostAiAction({
      action: dependency === "model" ? "summary" : dependency,
      post: { id: "post-1", title: "Title", slug: "title", content: "Article body", excerpt: null, seoDescription: null, category: null, tags: [], published: false },
    })).rejects.toMatchObject({ name: "AiInfrastructureError", cause: failure });
  });

  test("generates an SEO description through an OpenAI-compatible model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "  这是一段适合搜索展示的 SEO 描述。 " } }],
        }),
      }),
    );

    const { runPostAiAction } = await import("../ai-post-actions");
    const result = await runPostAiAction({
      action: "seo-description",
      post: {
        id: "post-1",
        title: "AI 内容运营",
        slug: "ai-content",
        content: "正文内容",
        excerpt: null,
        seoDescription: null,
        category: null,
        tags: [],
        published: false,
      },
    });

    expect(result).toEqual({
      action: "seo-description",
      modelId: "model-1",
      output: { seoDescription: "这是一段适合搜索展示的 SEO 描述。" },
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://compat.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
      }),
    );
  });

  test("generates tag suggestions as existing tag ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tagIds":["tag-ai","tag-next"],"names":["AI","Next.js"]}' } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.tagFindMany.mockResolvedValueOnce([
      { id: "tag-ai", name: "AI", slug: "ai" },
      { id: "tag-next", name: "Next.js", slug: "nextjs" },
      { id: "tag-life", name: "生活", slug: "life" },
    ]);

    const { runPostAiAction } = await import("../ai-post-actions");
    const result = await runPostAiAction({
      action: "tags",
      post: {
        id: "post-1",
        title: "用 AI 优化 Next.js 内容工作流",
        slug: "ai-nextjs-workflow",
        content: "正文内容",
        excerpt: null,
        seoDescription: null,
        category: null,
        tags: [],
        published: false,
      },
    });

    expect(result).toEqual({
      action: "tags",
      modelId: "model-1",
      output: {
        existingTagIds: ["tag-ai", "tag-next"],
        tagSlugs: ["ai", "nextjs"],
        names: ["AI", "Next.js"],
        newTagNames: [],
      },
    });
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { messages: Array<{ content: string }> };
    expect(requestBody.messages[1].content).toContain("只能从已有标签中选择");
    expect(requestBody.messages[1].content).toContain('"id":"tag-ai"');
  });

  test("matches common AI tag output shapes back to existing tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"selectedTags":[{"name":"AI"},{"slug":"nextjs"}],"tagNames":["不存在"]}' } }],
        }),
      }),
    );
    mocks.tagFindMany.mockResolvedValueOnce([
      { id: "tag-ai", name: "AI", slug: "ai" },
      { id: "tag-next", name: "Next.js", slug: "nextjs" },
    ]);

    const { runPostAiAction } = await import("../ai-post-actions");
    const result = await runPostAiAction({
      action: "tags",
      post: {
        id: "post-1",
        title: "AI 内容工作流",
        slug: "ai-workflow",
        content: "正文内容",
        excerpt: null,
        seoDescription: null,
        category: null,
        tags: [],
        published: false,
      },
    });

    expect(result.output).toEqual({
      existingTagIds: ["tag-ai", "tag-next"],
      tagSlugs: ["ai", "nextjs"],
      names: ["AI", "Next.js"],
      newTagNames: [],
    });
  });

  test("rejects AI tag suggestions that do not match existing tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"tagIds":["invented-tag"],"names":["不存在"]}' } }],
        }),
      }),
    );
    mocks.tagFindMany.mockResolvedValueOnce([{ id: "tag-ai", name: "AI", slug: "ai" }]);

    const { runPostAiAction } = await import("../ai-post-actions");
    await expect(
      runPostAiAction({
        action: "tags",
        post: {
          id: "post-1",
          title: "AI 内容工作流",
          slug: "ai-workflow",
          content: "正文内容",
          excerpt: null,
          seoDescription: null,
          category: null,
          tags: [],
          published: false,
        },
      }),
    ).rejects.toThrow("AI tag output did not match existing tags");
  });

  test("applies a successful SEO task item without repeating task completion", async () => {
    const { applyPostAiTaskItem, buildPostAiInputSnapshot } = await import("../ai-post-actions");
    const before = { id: "post-1", title: "Title", content: "Body", slug: "post-1", authorId: "author-1", excerpt: null, seoDescription: null, published: true, category: null, tags: [] };
    mocks.getAiTaskItem.mockResolvedValue({ id: "item-1", taskId: "task-1", postId: "post-1", status: "SUCCEEDED", applied: false, action: "seo-description", inputSnapshot: buildPostAiInputSnapshot(before, "seo-description"), output: { seoDescription: "新的 SEO 描述" } });
    mocks.postFindFirst.mockResolvedValueOnce(before).mockResolvedValueOnce({ ...before, seoDescription: "新的 SEO 描述" });
    const updated = await applyPostAiTaskItem("item-1");
    expect(updated.seoDescription).toBe("新的 SEO 描述");
    expect(mocks.postUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "post-1", authorId: "author-1", deletedAt: null }, data: expect.objectContaining({ seoDescription: "新的 SEO 描述", seoModelId: "model-1" }) }));
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { applied: true } }));
    expect(mocks.markAiTaskItemSucceeded).not.toHaveBeenCalled();
  });

  test("applies a successful tag task item using only active existing tag IDs", async () => {
    const { applyPostAiTaskItem, buildPostAiInputSnapshot } = await import("../ai-post-actions");
    const before = { id: "post-1", title: "Title", content: "Body", slug: "post-1", authorId: "author-1", excerpt: null, seoDescription: null, published: false, category: null, tags: [] };
    const tags = [{ id: "tag-ai", name: "AI", slug: "ai" }, { id: "tag-next", name: "Next.js", slug: "nextjs" }];
    mocks.getAiTaskItem.mockResolvedValue({ id: "item-1", taskId: "task-1", postId: "post-1", status: "SUCCEEDED", applied: false, action: "tags", inputSnapshot: buildPostAiInputSnapshot(before, "tags"), output: { existingTagIds: ["tag-ai", "tag-next"] } });
    mocks.tagFindMany.mockResolvedValueOnce(tags);
    mocks.postFindFirst.mockResolvedValueOnce(before).mockResolvedValueOnce({ ...before, tags });
    const updated = await applyPostAiTaskItem("item-1");
    expect(mocks.postUpdate).toHaveBeenCalledWith({ where: { id: "post-1" }, data: { tags: { set: [{ id: "tag-ai" }, { id: "tag-next" }] } } });
    expect(updated.tags).toEqual(tags);
  });

  test("rejects tag task items without existing tag ids instead of clearing tags", async () => {
    const { applyPostAiTaskItem, buildPostAiInputSnapshot } = await import("../ai-post-actions");
    const before = { id: "post-1", title: "Title", content: "Body", slug: "post-1", authorId: "author-1", excerpt: null, seoDescription: null, published: false, category: null, tags: [] };
    mocks.getAiTaskItem.mockResolvedValue({ id: "item-1", taskId: "task-1", postId: "post-1", status: "SUCCEEDED", applied: false, action: "tags", inputSnapshot: buildPostAiInputSnapshot(before, "tags"), output: { newTagNames: ["不存在"] } });
    mocks.postFindFirst.mockResolvedValueOnce(before);
    await expect(applyPostAiTaskItem("item-1")).rejects.toThrow("AI tag output did not match existing tags");
    expect(mocks.postUpdate).not.toHaveBeenCalled();
    expect(mocks.postUpdateMany).not.toHaveBeenCalled();
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
  });
});
