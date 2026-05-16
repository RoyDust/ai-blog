import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: prismaMocks.queryRawUnsafe,
  },
}));

import { calculateReadingStreak, getUserReadingStats, normalizeMonthlyReadingGoal } from "@/lib/reading-stats";

describe("reading stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("normalizes monthly reading goals", () => {
    expect(normalizeMonthlyReadingGoal("15")).toBe(15);
    expect(normalizeMonthlyReadingGoal(0)).toBe(1);
    expect(normalizeMonthlyReadingGoal(1200)).toBe(999);
    expect(normalizeMonthlyReadingGoal("invalid", 20)).toBe(20);
  });

  test("calculates consecutive reading days from unique day keys", () => {
    expect(calculateReadingStreak(["2026-05-16", "2026-05-15", "2026-05-14", "2026-05-12"])).toBe(3);
    expect(calculateReadingStreak(["2026-05-16", "2026-05-16", "2026-05-15"])).toBe(2);
    expect(calculateReadingStreak([])).toBe(0);
  });

  test("reads user stats from qualified reading events and published posts", async () => {
    prismaMocks.queryRawUnsafe
      .mockResolvedValueOnce([{ value: 8 }])
      .mockResolvedValueOnce([{ value: "125" }])
      .mockResolvedValueOnce([{ value: BigInt(4) }])
      .mockResolvedValueOnce([
        { day: "2026-05-16" },
        { day: "2026-05-15" },
        { day: "2026-05-14" },
        { day: "2026-05-12" },
      ]);

    await expect(getUserReadingStats("user-1", 10, new Date("2026-05-16T12:00:00Z"))).resolves.toEqual({
      totalArticles: 8,
      totalReadingMinutes: 125,
      streakDays: 3,
      monthlyRead: 4,
      monthlyGoal: 10,
      monthlyProgress: 40,
    });

    expect(prismaMocks.queryRawUnsafe).toHaveBeenCalledTimes(4);
    expect(prismaMocks.queryRawUnsafe.mock.calls[0][1]).toBe("user-1");
    expect(prismaMocks.queryRawUnsafe.mock.calls[0][0]).toContain('"reading_events"');
  });

  test("returns empty stats when storage is not ready", async () => {
    prismaMocks.queryRawUnsafe.mockRejectedValueOnce(Object.assign(new Error('relation "reading_events" does not exist'), { code: "42P01" }));

    await expect(getUserReadingStats("user-1", 12)).resolves.toEqual({
      totalArticles: 0,
      totalReadingMinutes: 0,
      streakDays: 0,
      monthlyRead: 0,
      monthlyGoal: 12,
      monthlyProgress: 0,
    });
  });
});
