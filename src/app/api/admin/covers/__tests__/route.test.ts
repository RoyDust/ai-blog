import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const listCoverAssets = vi.fn();
const createCoverAsset = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/cover-assets", () => ({
  listCoverAssets,
  createCoverAsset,
}));

describe("/api/admin/covers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects unauthenticated list requests", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/covers"));

    expect(response.status).toBe(401);
    expect(listCoverAssets).not.toHaveBeenCalled();
  });

  test("lists cover assets for admins", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    listCoverAssets.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/covers?q=tech&status=active"));

    expect(response.status).toBe(200);
    expect(listCoverAssets).toHaveBeenCalledWith(expect.objectContaining({
      q: "tech",
      status: "active",
      page: 1,
      limit: 10,
    }));
  });

  test("creates a cover asset for admins", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    createCoverAsset.mockResolvedValueOnce({ id: "cover-1", url: "https://cdn.example.com/covers/a.jpg" });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/covers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://cdn.example.com/covers/a.jpg",
        key: "covers/a.jpg",
        tags: ["tech"],
      }),
    }));

    expect(response.status).toBe(200);
    expect(createCoverAsset).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://cdn.example.com/covers/a.jpg",
      key: "covers/a.jpg",
      createdById: "admin-1",
    }));
  });
});
