import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const findManyMock = vi.fn();
const createMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: {
      findMany: findManyMock,
      create: createMock,
      updateMany: updateManyMock,
    },
    $transaction: async (callback: (tx: {
      aiModel: {
        create: typeof createMock;
        updateMany: typeof updateManyMock;
      };
    }) => unknown) =>
      callback({
        aiModel: {
          create: createMock,
          updateMany: updateManyMock,
        },
      }),
  },
}));

describe("admin AI models route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    process.env = {
      ...originalEnv,
      AUTH_SECRET: "test-secret-for-ai-model-key-encryption",
      AI_OPENAI_COMPAT_API_KEY: "test-ai-key",
      AI_OPENAI_COMPAT_BASE_URL: "https://compat.example/v1",
      AI_OPENAI_COMPAT_MODEL: "summary-model",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("returns sanitized model options for admins", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);

    const { GET } = await import("../route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data[0]).toMatchObject({
      id: "post-summary-openai-compatible",
      name: "文章摘要生成",
      baseUrl: "https://compat.example/v1",
      requestPath: "/chat/completions",
      model: "summary-model",
      status: "ready",
    });
    expect(data.data[0]).not.toHaveProperty("apiKey");
  });

  test("creates custom models for admins", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never);
    const createdAt = new Date("2026-04-25T00:00:00Z");
    createMock.mockImplementationOnce(({ data }) =>
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

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "测试模型",
          baseUrl: "https://compat.example/v1",
          model: "summary-model",
          apiKey: "secret",
          isDefaultForSummary: true,
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data).toMatchObject({
      id: "model-1",
      name: "测试模型",
      source: "database",
      editable: true,
      deletable: true,
      hasApiKey: true,
    });
    expect(data.data).not.toHaveProperty("apiKey");
  });

  test("rejects anonymous requests", async () => {
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });
});
