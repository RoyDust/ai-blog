import { afterEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  updateManyMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: {
      findMany: prismaMocks.findManyMock,
      findUnique: prismaMocks.findUniqueMock,
      count: prismaMocks.countMock,
      create: prismaMocks.createMock,
      update: prismaMocks.updateMock,
      updateMany: prismaMocks.updateManyMock,
      delete: prismaMocks.deleteMock,
    },
    $transaction: async (callback: (tx: {
      aiModel: {
        create: typeof prismaMocks.createMock;
        update: typeof prismaMocks.updateMock;
        updateMany: typeof prismaMocks.updateManyMock;
      };
    }) => unknown) =>
      callback({
        aiModel: {
          create: prismaMocks.createMock,
          update: prismaMocks.updateMock,
          updateMany: prismaMocks.updateManyMock,
        },
      }),
  },
}));

import { createAiModel, getAiModelForCapability, getAiModelOptions, toPublicAiModelOption, updateAiModel } from "../ai-models";

describe("ai model registry", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  test("exposes the current summary generator as the first OpenAI-compatible option", async () => {
    prismaMocks.findManyMock.mockResolvedValue([]);
    prismaMocks.countMock.mockResolvedValueOnce(0);
    process.env = {
      ...originalEnv,
      AI_OPENAI_COMPAT_API_KEY: "",
      AI_OPENAI_COMPAT_BASE_URL: "",
      AI_OPENAI_COMPAT_MODEL: "",
      DASHSCOPE_API_KEY: "dashscope-key",
      DASHSCOPE_BASE_URL: "https://dashscope.example/v1/",
      DASHSCOPE_MODEL: "qwen-summary",
    };

    const [firstModel] = await getAiModelOptions();

    expect(firstModel).toMatchObject({
      id: "post-summary-openai-compatible",
      name: "文章摘要生成",
      provider: "openai-compatible",
      baseUrl: "https://dashscope.example/v1",
      requestPath: "/chat/completions",
      model: "qwen-summary",
      apiKeyEnv: "DASHSCOPE_API_KEY",
      capabilities: ["post-summary"],
      defaultFor: ["post-summary"],
      status: "ready",
    });
    await expect(getAiModelForCapability("post-summary")).resolves.toMatchObject({ id: firstModel.id });
  });

  test("prefers generic OpenAI-compatible env vars over the legacy DashScope fallback", async () => {
    prismaMocks.findManyMock.mockResolvedValueOnce([]);
    process.env = {
      ...originalEnv,
      AI_OPENAI_COMPAT_API_KEY: "compat-key",
      AI_OPENAI_COMPAT_BASE_URL: "https://compat.example/v1",
      AI_OPENAI_COMPAT_MODEL: "compat-summary",
      DASHSCOPE_API_KEY: "dashscope-key",
      DASHSCOPE_BASE_URL: "https://dashscope.example/v1",
      DASHSCOPE_MODEL: "qwen-summary",
    };

    const [firstModel] = await getAiModelOptions();

    expect(firstModel).toMatchObject({
      baseUrl: "https://compat.example/v1",
      model: "compat-summary",
      apiKey: "compat-key",
      apiKeyEnv: "AI_OPENAI_COMPAT_API_KEY",
      baseUrlEnv: "AI_OPENAI_COMPAT_BASE_URL",
      modelEnv: "AI_OPENAI_COMPAT_MODEL",
    });
  });

  test("public model payload omits the resolved API key", async () => {
    prismaMocks.findManyMock.mockResolvedValueOnce([]);
    process.env = {
      ...originalEnv,
      AI_OPENAI_COMPAT_API_KEY: "secret-key",
    };

    const [firstModel] = await getAiModelOptions();
    const publicModel = toPublicAiModelOption(firstModel);

    expect(publicModel).not.toHaveProperty("apiKey");
    expect(publicModel).toMatchObject({
      id: "post-summary-openai-compatible",
      status: "ready",
      hasApiKey: true,
    });
  });

  test("falls back to the environment model when model storage is not migrated", async () => {
    prismaMocks.findManyMock.mockRejectedValueOnce({ code: "P2021" });
    process.env = {
      ...originalEnv,
      AI_OPENAI_COMPAT_API_KEY: "secret-key",
      AI_OPENAI_COMPAT_BASE_URL: "https://compat.example/v1",
      AI_OPENAI_COMPAT_MODEL: "summary-model",
    };

    const models = await getAiModelOptions();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "post-summary-openai-compatible",
      source: "environment",
      defaultFor: ["post-summary"],
      status: "ready",
    });
  });

  test("creates a persisted model and clears older summary defaults", async () => {
    const createdAt = new Date("2026-04-25T00:00:00Z");
    process.env = {
      ...originalEnv,
      AUTH_SECRET: "test-secret-for-ai-model-key-encryption",
    };
    prismaMocks.createMock.mockImplementationOnce(({ data }) =>
      Promise.resolve({
        id: "model-1",
        ...data,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        createdAt,
        updatedAt: createdAt,
      }),
    );

    const model = await createAiModel({
      name: "测试模型",
      baseUrl: "https://compat.example/v1/",
      model: "summary-model",
      apiKey: "secret",
      isDefaultForSummary: true,
    });

    expect(prismaMocks.createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apiKey: expect.stringMatching(/^enc:v1:/),
      }),
    });
    expect(prismaMocks.createMock.mock.calls[0]?.[0]?.data.apiKey).not.toBe("secret");
    expect(prismaMocks.updateManyMock).toHaveBeenCalledWith({
      where: { isDefaultForSummary: true },
      data: { isDefaultForSummary: false },
    });
    expect(model).toMatchObject({
      id: "model-1",
      baseUrl: "https://compat.example/v1",
      defaultFor: ["post-summary"],
      source: "database",
      editable: true,
    });
    expect(model.apiKey).toBe("secret");
  });

  test("patch updates preserve omitted model fields", async () => {
    const createdAt = new Date("2026-04-25T00:00:00Z");
    const existing = {
      id: "model-1",
      name: "旧模型",
      description: "旧描述",
      provider: "openai-compatible",
      baseUrl: "https://compat.example/v1",
      requestPath: "/chat/completions",
      model: "old-model",
      apiKey: "secret",
      capabilities: ["post-summary"],
      isDefaultForSummary: true,
      enabled: true,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
      createdAt,
      updatedAt: createdAt,
    };
    prismaMocks.findUniqueMock.mockResolvedValueOnce(existing);
    prismaMocks.updateMock.mockImplementationOnce(({ data }) => Promise.resolve({ ...existing, ...data }));

    const model = await updateAiModel("model-1", { name: "新模型" });

    expect(prismaMocks.updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "model-1" },
      data: expect.objectContaining({
        name: "新模型",
        description: "旧描述",
        baseUrl: "https://compat.example/v1",
        model: "old-model",
        enabled: true,
        isDefaultForSummary: true,
      }),
    }));
    expect(prismaMocks.updateMock.mock.calls[0]?.[0]?.data).not.toHaveProperty("apiKey");
    expect(model).toMatchObject({
      name: "新模型",
      defaultFor: ["post-summary"],
    });
  });

  test("disabled database defaults do not override the environment model", async () => {
    const createdAt = new Date("2026-04-25T00:00:00Z");
    prismaMocks.findManyMock.mockResolvedValueOnce([
      {
        id: "disabled-default",
        name: "停用默认",
        description: "",
        provider: "openai-compatible",
        baseUrl: "https://compat.example/v1",
        requestPath: "/chat/completions",
        model: "disabled-model",
        apiKey: "secret",
        capabilities: ["post-summary"],
        isDefaultForSummary: true,
        enabled: false,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    process.env = {
      ...originalEnv,
      AI_OPENAI_COMPAT_API_KEY: "env-key",
    };

    const models = await getAiModelOptions();

    expect(models[0]).toMatchObject({
      id: "post-summary-openai-compatible",
      defaultFor: ["post-summary"],
    });
    expect(models[1]).toMatchObject({
      id: "disabled-default",
      defaultFor: [],
      status: "disabled",
    });
  });

  test("returns a clear validation error when creating before storage migration", async () => {
    process.env = {
      ...originalEnv,
      AUTH_SECRET: "test-secret-for-ai-model-key-encryption",
    };
    prismaMocks.createMock.mockRejectedValueOnce({ code: "P2021" });

    await expect(createAiModel({
      name: "测试模型",
      baseUrl: "https://compat.example/v1",
      model: "summary-model",
      apiKey: "secret",
    })).rejects.toMatchObject({
      name: "ValidationError",
      message: "AI model storage is not ready. Apply the AI model database migration first.",
    });
  });
});
