import { beforeEach, describe, expect, test, vi } from "vitest";

const getServerSession = vi.fn();
const backfillMissingPostCovers = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/cover-assets", () => ({
  backfillMissingPostCovers,
}));

describe("/api/admin/covers/randomize-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requires admin access", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/covers/randomize-posts", {
      method: "POST",
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(401);
    expect(backfillMissingPostCovers).not.toHaveBeenCalled();
  });

  test("starts missing-cover backfill", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    backfillMissingPostCovers.mockResolvedValueOnce({ updated: 2, skipped: 0 });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/covers/randomize-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postIds: ["post-1"], publishedOnly: false }),
    }));

    expect(response.status).toBe(200);
    expect(backfillMissingPostCovers).toHaveBeenCalledWith({
      postIds: ["post-1"],
      publishedOnly: false,
      replaceExisting: false,
      nonAiDailyOnly: true,
    });
  });

  test("passes explicit replace mode for current non AI daily cover refresh", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } });
    backfillMissingPostCovers.mockResolvedValueOnce({ updated: 3, skipped: 0 });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/covers/randomize-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedOnly: false, replaceExisting: true }),
    }));

    expect(response.status).toBe(200);
    expect(backfillMissingPostCovers).toHaveBeenCalledWith({
      postIds: undefined,
      publishedOnly: false,
      replaceExisting: true,
      nonAiDailyOnly: true,
    });
  });
});
