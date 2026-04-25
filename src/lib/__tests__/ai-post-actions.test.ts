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
});
