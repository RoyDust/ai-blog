import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const setDefaultAiModelForCapability = vi.fn();
const toPublicAiModelOption = vi.fn((model) => model);

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/ai-models", () => ({
  setDefaultAiModelForCapability,
  toPublicAiModelOption,
}));

describe("admin AI model default route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("switches the summary default model for admins", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    setDefaultAiModelForCapability.mockResolvedValueOnce({
      id: "model-1",
      defaultFor: ["post-summary"],
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/models/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: "model-1", capability: "post-summary" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(setDefaultAiModelForCapability).toHaveBeenCalledWith("post-summary", "model-1");
    expect(data.data).toMatchObject({ id: "model-1" });
  });

  test("rejects missing model ids", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/models/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    expect(setDefaultAiModelForCapability).not.toHaveBeenCalled();
  });

  test("requires admin access", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/ai/models/default", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1" }),
    }));

    expect(response.status).toBe(401);
  });
});
