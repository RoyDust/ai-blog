import { beforeEach, describe, expect, test, vi } from "vitest";

const requireAdminSession = vi.fn();
const listAdminTopicGuides = vi.fn();
const createTopicGuide = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/topic-guides", () => ({
  listAdminTopicGuides,
  createTopicGuide,
}));

describe("/api/admin/topic-guides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("lists guides for admins", async () => {
    listAdminTopicGuides.mockResolvedValueOnce([{ id: "guide-1", title: "Guide" }]);

    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual([{ id: "guide-1", title: "Guide" }]);
    expect(requireAdminSession).toHaveBeenCalled();
  });

  test("creates a guide from selected post ids", async () => {
    createTopicGuide.mockResolvedValueOnce({ id: "guide-1", title: "Guide" });

    const body = { title: "Guide", slug: "guide", postIds: ["post-1", "post-2"] };
    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/topic-guides", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(200);
    expect(createTopicGuide).toHaveBeenCalledWith(body);
  });
});
