import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiModelForCapability: vi.fn(),
  postUpdate: vi.fn(),
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
}));

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent: mocks.revalidatePublicContent,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      update: mocks.postUpdate,
    },
    tag: {
      findMany: mocks.tagFindMany,
    },
    category: {
      findMany: mocks.categoryFindMany,
    },
  },
}));

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
    process.env.AI_POST_SUMMARY_TIMEOUT_MS = "90000";
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
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
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

  test("applies a successful SEO task item to the linked post", async () => {
    mocks.getAiTaskItem.mockResolvedValueOnce({
      id: "item-1",
      postId: "post-1",
      status: "SUCCEEDED",
      action: "seo-description",
      output: { seoDescription: "新的 SEO 描述" },
      task: { modelId: "model-1" },
      post: { id: "post-1" },
    });
    mocks.postUpdate.mockResolvedValueOnce({
      id: "post-1",
      title: "标题",
      slug: "post-1",
      excerpt: null,
      seoDescription: "新的 SEO 描述",
      published: true,
      category: { id: "cat-1", name: "前端", slug: "frontend" },
      tags: [{ id: "tag-1", name: "AI", slug: "ai" }],
    });

    const { applyPostAiTaskItem } = await import("../ai-post-actions");
    const updated = await applyPostAiTaskItem("item-1");

    expect(mocks.postUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-1" },
        data: expect.objectContaining({
          seoDescription: "新的 SEO 描述",
          seoModelId: "model-1",
        }),
      }),
    );
    expect(mocks.markAiTaskItemSucceeded).toHaveBeenCalledWith("item-1", { seoDescription: "新的 SEO 描述" }, true);
    expect(updated.seoDescription).toBe("新的 SEO 描述");
  });

  test("applies a successful tag task item to the linked post", async () => {
    mocks.getAiTaskItem.mockResolvedValueOnce({
      id: "item-1",
      postId: "post-1",
      status: "SUCCEEDED",
      action: "tags",
      output: { existingTagIds: ["tag-ai", "tag-next"], names: ["AI", "Next.js"] },
      task: { modelId: "model-1" },
      post: { id: "post-1" },
    });
    mocks.postUpdate.mockResolvedValueOnce({
      id: "post-1",
      title: "标题",
      slug: "post-1",
      excerpt: null,
      seoDescription: null,
      published: false,
      category: null,
      tags: [
        { id: "tag-ai", name: "AI", slug: "ai" },
        { id: "tag-next", name: "Next.js", slug: "nextjs" },
      ],
    });

    const { applyPostAiTaskItem } = await import("../ai-post-actions");
    const updated = await applyPostAiTaskItem("item-1");

    expect(mocks.postUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post-1" },
        data: expect.objectContaining({
          tags: { set: [{ id: "tag-ai" }, { id: "tag-next" }] },
        }),
      }),
    );
    expect(updated.tags).toEqual([
      { id: "tag-ai", name: "AI", slug: "ai" },
      { id: "tag-next", name: "Next.js", slug: "nextjs" },
    ]);
  });

  test("rejects tag task items without existing tag ids instead of clearing tags", async () => {
    mocks.getAiTaskItem.mockResolvedValueOnce({
      id: "item-1",
      postId: "post-1",
      status: "SUCCEEDED",
      action: "tags",
      output: { newTagNames: ["不存在"] },
      task: { modelId: "model-1" },
      post: { id: "post-1" },
    });

    const { applyPostAiTaskItem } = await import("../ai-post-actions");
    await expect(applyPostAiTaskItem("item-1")).rejects.toThrow("AI tag output did not match existing tags");
    expect(mocks.postUpdate).not.toHaveBeenCalled();
    expect(mocks.markAiTaskItemSucceeded).not.toHaveBeenCalled();
  });
});
