import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const getAdminTopicGuideById = vi.fn();
const updateTopicGuide = vi.fn();
const softDeleteTopicGuide = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/topic-guides", () => ({
  getAdminTopicGuideById,
  updateTopicGuide,
  softDeleteTopicGuide,
}));

describe("/api/admin/topic-guides/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("returns a single guide", async () => {
    getAdminTopicGuideById.mockResolvedValueOnce({ id: "guide-1", title: "Guide" });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/topic-guides/guide-1"), {
      params: Promise.resolve({ id: "guide-1" }),
    });

    expect(response.status).toBe(200);
    expect(getAdminTopicGuideById).toHaveBeenCalledWith("guide-1");
  });

  test("publishes or archives a guide through partial status updates", async () => {
    updateTopicGuide.mockResolvedValueOnce({ id: "guide-1", status: "published" });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/topic-guides/guide-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "published" }),
    }), {
      params: Promise.resolve({ id: "guide-1" }),
    });

    expect(response.status).toBe(200);
    expect(updateTopicGuide).toHaveBeenCalledWith("guide-1", { status: "published" });
  });

  test("soft deletes a guide", async () => {
    softDeleteTopicGuide.mockResolvedValueOnce({ id: "guide-1" });

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/topic-guides/guide-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "guide-1" }),
    });

    expect(response.status).toBe(200);
    expect(softDeleteTopicGuide).toHaveBeenCalledWith("guide-1");
  });
});
