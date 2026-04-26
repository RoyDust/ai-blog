import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const updateCoverAsset = vi.fn();
const softDeleteCoverAsset = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/cover-assets", () => ({
  updateCoverAsset,
  softDeleteCoverAsset,
}));

describe("/api/admin/covers/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects unauthenticated patch requests", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/covers/cover-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Cover" }),
    }), { params: Promise.resolve({ id: "cover-1" }) });

    expect(response.status).toBe(401);
    expect(updateCoverAsset).not.toHaveBeenCalled();
  });

  test("updates cover metadata", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    updateCoverAsset.mockResolvedValueOnce({ id: "cover-1", title: "Cover" });

    const { PATCH } = await import("../route");
    const response = await PATCH(new Request("http://localhost/api/admin/covers/cover-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Cover", tags: ["hero"], status: "active" }),
    }), { params: Promise.resolve({ id: "cover-1" }) });

    expect(response.status).toBe(200);
    expect(updateCoverAsset).toHaveBeenCalledWith("cover-1", expect.objectContaining({
      title: "Cover",
      tags: ["hero"],
      status: "active",
    }));
  });

  test("soft deletes cover assets", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    softDeleteCoverAsset.mockResolvedValueOnce({ id: "cover-1", deletedAt: new Date("2026-04-26") });

    const { DELETE } = await import("../route");
    const response = await DELETE(new Request("http://localhost/api/admin/covers/cover-1", {
      method: "DELETE",
    }), { params: Promise.resolve({ id: "cover-1" }) });

    expect(response.status).toBe(200);
    expect(softDeleteCoverAsset).toHaveBeenCalledWith("cover-1");
  });
});
