import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: {
      findUnique: findUniqueMock,
      count: vi.fn(),
      update: updateMock,
    },
  },
}));

const dbModel = {
  id: "model-1",
  name: "测试模型",
  description: "",
  provider: "openai-compatible",
  baseUrl: "https://compat.example/v1",
  requestPath: "/chat/completions",
  model: "summary-model",
  apiKey: "secret",
  capabilities: ["post-summary"],
  isDefaultForSummary: false,
  enabled: true,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestMessage: null,
  createdAt: new Date("2026-04-25T00:00:00Z"),
  updatedAt: new Date("2026-04-25T00:00:00Z"),
};

describe("admin AI model test route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
  });

  test("tests a model through the OpenAI-compatible chat completions endpoint", async () => {
    findUniqueMock.mockResolvedValue(dbModel);
    updateMock.mockResolvedValue(dbModel);
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", upstreamFetch);

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/models/model-1/test", { method: "POST" }), {
      params: Promise.resolve({ id: "model-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://compat.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
    expect(JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "summary-model",
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "model-1" },
      data: expect.objectContaining({ lastTestStatus: "success" }),
    }));
    expect(data.data.message).toContain("连接成功");
  });

  test("records failed model tests", async () => {
    findUniqueMock.mockResolvedValue(dbModel);
    updateMock.mockResolvedValue(dbModel);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "bad key" } }),
      }),
    );

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/models/model-1/test", { method: "POST" }), {
      params: Promise.resolve({ id: "model-1" }),
    });

    expect(response.status).toBe(502);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "model-1" },
      data: expect.objectContaining({ lastTestStatus: "failed", lastTestMessage: "bad key" }),
    }));
  });
});
