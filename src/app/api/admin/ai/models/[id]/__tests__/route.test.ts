import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const updateManyMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiModel: {
      findUnique: findUniqueMock,
      update: updateMock,
      updateMany: updateManyMock,
      delete: deleteMock,
    },
    $transaction: async (callback: (tx: {
      aiModel: {
        update: typeof updateMock;
        updateMany: typeof updateManyMock;
      };
    }) => unknown) =>
      callback({
        aiModel: {
          update: updateMock,
          updateMany: updateManyMock,
        },
      }),
  },
}));

const dbModel = {
  id: "model-1",
  name: "旧模型",
  description: "",
  provider: "openai-compatible",
  baseUrl: "https://compat.example/v1",
  requestPath: "/chat/completions",
  model: "old-model",
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

describe("admin AI model item route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getServerSession } = await import("next-auth");
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as never);
  });

  test("updates custom model fields", async () => {
    findUniqueMock.mockResolvedValueOnce(dbModel);
    updateMock.mockImplementationOnce(({ data }) => Promise.resolve({ ...dbModel, ...data, name: data.name }));

    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/ai/models/model-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "新模型",
          baseUrl: "https://compat.example/v1",
          model: "new-model",
          enabled: true,
        }),
      }),
      { params: Promise.resolve({ id: "model-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "model-1" },
        data: expect.objectContaining({ name: "新模型", model: "new-model" }),
      }),
    );
    expect(data.data).toMatchObject({ id: "model-1", name: "新模型" });
  });

  test("deletes custom models", async () => {
    findUniqueMock.mockResolvedValueOnce(dbModel);
    deleteMock.mockResolvedValueOnce(dbModel);

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/ai/models/model-1"), {
      params: Promise.resolve({ id: "model-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "model-1" } });
  });
});
