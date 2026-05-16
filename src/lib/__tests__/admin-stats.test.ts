import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findVisitLogsInRange: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/visit-log-repository", () => ({
  findVisitLogsInRange: mocks.findVisitLogsInRange,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

describe("admin stats aggregation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findVisitLogsInRange.mockResolvedValue([]);
    mocks.queryRawUnsafe.mockResolvedValue([]);
  });

  test("normalizes stats ranges to 7, 30, and 90 days", async () => {
    const { getDashboardStats } = await import("@/lib/admin-stats");
    const now = new Date("2026-05-16T12:00:00Z");

    await expect(getDashboardStats("7", now)).resolves.toMatchObject({ range: 7 });
    await expect(getDashboardStats("30", now)).resolves.toMatchObject({ range: 30 });
    await expect(getDashboardStats("90", now)).resolves.toMatchObject({ range: 90 });
    await expect(getDashboardStats("365", now)).resolves.toMatchObject({ range: 7 });
  });

  test("aggregates visit trend from existing visit logs", async () => {
    const { getVisitTrendStats } = await import("@/lib/admin-stats");
    const now = new Date("2026-05-16T12:00:00Z");
    mocks.findVisitLogsInRange.mockResolvedValue([
      { createdAt: new Date("2026-05-16T01:00:00Z"), visitorId: "reader-1", ipHash: "ip-1", userAgent: "ua-1" },
      { createdAt: new Date("2026-05-16T02:00:00Z"), visitorId: "reader-1", ipHash: "ip-1", userAgent: "ua-1" },
      { createdAt: new Date("2026-05-15T03:00:00Z"), visitorId: null, ipHash: "ip-2", userAgent: "ua-2" },
    ]);

    const stats = await getVisitTrendStats(7, now);

    expect(stats.summary).toEqual({
      totalPv: 3,
      totalUv: 2,
      todayPv: 2,
      yesterdayPv: 1,
    });
    expect(stats.trend).toHaveLength(7);
    expect(stats.trend.at(-1)).toMatchObject({ date: "2026-05-16", pv: 2, uv: 1 });
    expect(mocks.findVisitLogsInRange).toHaveBeenCalledWith(new Date("2026-05-10T00:00:00.000Z"), new Date("2026-05-17T00:00:00.000Z"));
  });

  test("aggregates reading duration, qualified reads, and completion depth", async () => {
    const { getReadingStats } = await import("@/lib/admin-stats");
    const now = new Date("2026-05-16T12:00:00Z");
    mocks.queryRawUnsafe.mockResolvedValueOnce([
      { date: new Date("2026-05-15T00:00:00Z"), events: 1, qualified: 1, completed: 1, durationSeconds: 300 },
      { date: new Date("2026-05-16T00:00:00Z"), events: 2, qualified: 1, completed: 1, durationSeconds: 180 },
    ]);

    const stats = await getReadingStats(7, now);

    expect(stats.summary).toEqual({
      totalEvents: 3,
      qualifiedEvents: 2,
      completedEvents: 2,
      totalDurationSeconds: 480,
      averageDurationSeconds: 160,
    });
    expect(stats.trend.at(-1)).toMatchObject({ date: "2026-05-16", events: 2, qualified: 1, completed: 1, durationSeconds: 180 });
    expect(mocks.queryRawUnsafe.mock.calls[0][0]).toContain('FROM "reading_events"');
  });

  test("aggregates comments and likes into engagement stats", async () => {
    const { getEngagementStats } = await import("@/lib/admin-stats");
    const now = new Date("2026-05-16T12:00:00Z");
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        { date: new Date("2026-05-15T00:00:00Z"), count: 1 },
        { date: new Date("2026-05-16T00:00:00Z"), count: 1 },
      ])
      .mockResolvedValueOnce([
        { date: new Date("2026-05-15T00:00:00Z"), count: 1 },
        { date: new Date("2026-05-16T00:00:00Z"), count: 2 },
      ]);

    const stats = await getEngagementStats(7, now);

    expect(stats.summary).toEqual({ comments: 2, likes: 3, total: 5 });
    expect(stats.trend.at(-1)).toMatchObject({ date: "2026-05-16", comments: 1, likes: 2 });
    expect(mocks.queryRawUnsafe.mock.calls[0][0]).toContain('FROM "comments"');
    expect(mocks.queryRawUnsafe.mock.calls[1][0]).toContain('FROM "likes"');
  });

  test("returns stable empty stats without throwing", async () => {
    const { getDashboardStats } = await import("@/lib/admin-stats");

    const stats = await getDashboardStats(30, new Date("2026-05-16T12:00:00Z"));

    expect(stats.range).toBe(30);
    expect(stats.visits.hasData).toBe(false);
    expect(stats.reading.hasData).toBe(false);
    expect(stats.engagement.hasData).toBe(false);
    expect(stats.visits.trend).toHaveLength(30);
    expect(stats.reading.summary.totalEvents).toBe(0);
    expect(stats.engagement.summary.total).toBe(0);
  });
});
