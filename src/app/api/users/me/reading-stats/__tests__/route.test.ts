import { beforeEach, describe, expect, test, vi } from "vitest";

const requireSession = vi.fn();
const getBlogSettings = vi.fn();
const getUserReadingStats = vi.fn();

vi.mock("@/lib/api-auth", () => ({ requireSession }));
vi.mock("@/lib/blog-settings", () => ({ getBlogSettings }));
vi.mock("@/lib/reading-stats", () => ({ getUserReadingStats }));

describe("GET /api/users/me/reading-stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns reading stats for the current user", async () => {
    requireSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });
    getBlogSettings.mockResolvedValueOnce({ reading: { monthlyGoal: 12 } });
    getUserReadingStats.mockResolvedValueOnce({
      totalArticles: 3,
      totalReadingMinutes: 45,
      streakDays: 2,
      monthlyRead: 3,
      monthlyGoal: 12,
      monthlyProgress: 25,
    });

    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getUserReadingStats).toHaveBeenCalledWith("user-1", 12);
    expect(payload.data.monthlyProgress).toBe(25);
  });
});
