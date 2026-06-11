import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commentCount: vi.fn(),
  aiTaskCount: vi.fn(),
  postCount: vi.fn(),
  newsletterCampaignCount: vi.fn(),
  newsletterSubscriberCount: vi.fn(),
  findVisitLogsInRange: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/visit-log-repository", () => ({
  findVisitLogsInRange: mocks.findVisitLogsInRange,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
    aiTask: {
      count: mocks.aiTaskCount,
    },
    comment: {
      count: mocks.commentCount,
    },
    newsletterCampaign: {
      count: mocks.newsletterCampaignCount,
    },
    newsletterSubscriber: {
      count: mocks.newsletterSubscriberCount,
    },
    post: {
      count: mocks.postCount,
    },
  },
}));

describe("admin todo counts and comparison stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.commentCount.mockResolvedValue(0);
    mocks.aiTaskCount.mockResolvedValue(0);
    mocks.postCount.mockResolvedValue(0);
    mocks.newsletterCampaignCount.mockResolvedValue(0);
    mocks.newsletterSubscriberCount.mockResolvedValue(0);
    mocks.findVisitLogsInRange.mockResolvedValue([]);
    mocks.queryRawUnsafe.mockResolvedValue([]);
  });

  test("counts dashboard todo items with the expected filters", async () => {
    const { getAdminTodoCounts } = await import("@/lib/admin-stats");
    const now = new Date("2026-06-11T08:30:00Z");
    mocks.commentCount.mockResolvedValueOnce(3);
    mocks.aiTaskCount.mockResolvedValueOnce(2);
    mocks.postCount.mockResolvedValueOnce(5);
    mocks.newsletterCampaignCount.mockResolvedValueOnce(1);

    await expect(getAdminTodoCounts(now)).resolves.toEqual({
      pendingComments: 3,
      failedAiTasks: 2,
      staleDrafts: 5,
      pendingNewsletters: 1,
    });

    const sevenDaysAgo = new Date("2026-06-04T08:30:00.000Z");
    expect(mocks.commentCount).toHaveBeenCalledWith({ where: { deletedAt: null, status: "PENDING" } });
    expect(mocks.aiTaskCount).toHaveBeenCalledWith({
      where: {
        status: { in: ["FAILED", "PARTIAL_FAILED"] },
        finishedAt: { gte: sevenDaysAgo },
      },
    });
    expect(mocks.postCount).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        published: false,
        updatedAt: { lt: sevenDaysAgo },
      },
    });
    expect(mocks.newsletterCampaignCount).toHaveBeenCalledWith({
      where: { status: { in: ["DRAFT", "PARTIAL_FAILED", "FAILED"] } },
    });
  });

  test("returns a stable zero state when no todo items exist", async () => {
    const { getAdminTodoCounts } = await import("@/lib/admin-stats");

    await expect(getAdminTodoCounts(new Date("2026-06-11T08:30:00Z"))).resolves.toEqual({
      pendingComments: 0,
      failedAiTasks: 0,
      staleDrafts: 0,
      pendingNewsletters: 0,
    });
  });

  test("compares the current stats window with the immediately preceding window", async () => {
    const { getDashboardStatsWithComparison } = await import("@/lib/admin-stats");
    const now = new Date("2026-06-11T08:30:00Z");

    mocks.findVisitLogsInRange
      .mockResolvedValueOnce([
        { createdAt: new Date("2026-06-10T01:00:00Z"), visitorId: "reader-1", ipHash: null, userAgent: null },
        { createdAt: new Date("2026-06-11T01:00:00Z"), visitorId: "reader-2", ipHash: null, userAgent: null },
      ])
      .mockResolvedValueOnce([
        { createdAt: new Date("2026-06-04T01:00:00Z"), visitorId: "reader-3", ipHash: null, userAgent: null },
      ]);
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([{ date: new Date("2026-06-11T00:00:00Z"), events: 2, qualified: 2, completed: 1, durationSeconds: 600 }])
      .mockResolvedValueOnce([{ date: new Date("2026-06-11T00:00:00Z"), count: 2 }])
      .mockResolvedValueOnce([{ date: new Date("2026-06-11T00:00:00Z"), count: 2 }])
      .mockResolvedValueOnce([{ date: new Date("2026-06-04T00:00:00Z"), events: 1, qualified: 1, completed: 1, durationSeconds: 120 }])
      .mockResolvedValueOnce([{ date: new Date("2026-06-04T00:00:00Z"), count: 1 }])
      .mockResolvedValueOnce([]);
    mocks.postCount.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    mocks.newsletterSubscriberCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);

    const stats = await getDashboardStatsWithComparison("7", now);

    expect(mocks.findVisitLogsInRange).toHaveBeenCalledWith(new Date("2026-06-05T00:00:00.000Z"), new Date("2026-06-12T00:00:00.000Z"));
    expect(mocks.findVisitLogsInRange).toHaveBeenCalledWith(new Date("2026-05-29T00:00:00.000Z"), new Date("2026-06-05T00:00:00.000Z"));
    expect(mocks.postCount).toHaveBeenNthCalledWith(1, {
      where: {
        deletedAt: null,
        published: true,
        publishedAt: { gte: new Date("2026-06-05T00:00:00.000Z"), lt: new Date("2026-06-12T00:00:00.000Z") },
      },
    });
    expect(mocks.postCount).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: null,
        published: true,
        publishedAt: { gte: new Date("2026-05-29T00:00:00.000Z"), lt: new Date("2026-06-05T00:00:00.000Z") },
      },
    });
    expect(stats.metrics).toEqual({
      publishedPosts: 4,
      readingMinutes: 10,
      engagementRate: 2,
      subscribers: 2,
    });
    expect(stats.deltas).toEqual({
      visits: 1,
      publishedPosts: 3,
      readingMinutes: 8,
      engagementRate: 1,
      subscribers: 0,
    });
  });
});
