import {
  addUtcDays,
  formatVisitTrendDate,
  formatVisitTrendLabel,
  parseVisitTrendRange,
  startOfUtcDay,
  type VisitTrendRange,
} from "@/lib/analytics";
import { AI_TASK_STATUSES } from "@/lib/ai-tasks";
import { NEWSLETTER_STATUS_VERIFIED } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { findVisitLogsInRange } from "@/lib/visit-log-repository";

export type AdminStatsRange = VisitTrendRange;

const ADMIN_TODO_WINDOW_DAYS = 7;
const PENDING_COMMENT_STATUS = "PENDING";
const PENDING_NEWSLETTER_STATUSES = ["DRAFT", "PARTIAL_FAILED", "FAILED"] as const;

export type VisitTrendStatItem = {
  date: string;
  label: string;
  pv: number;
  uv: number;
};

export type VisitTrendStats = {
  range: AdminStatsRange;
  trend: VisitTrendStatItem[];
  summary: {
    totalPv: number;
    totalUv: number;
    todayPv: number;
    yesterdayPv: number;
  };
  hasData: boolean;
};

export type ReadingTrendStatItem = {
  date: string;
  label: string;
  events: number;
  qualified: number;
  completed: number;
  durationSeconds: number;
};

export type ReadingStats = {
  range: AdminStatsRange;
  trend: ReadingTrendStatItem[];
  summary: {
    totalEvents: number;
    qualifiedEvents: number;
    completedEvents: number;
    totalDurationSeconds: number;
    averageDurationSeconds: number;
  };
  hasData: boolean;
};

export type EngagementTrendStatItem = {
  date: string;
  label: string;
  comments: number;
  likes: number;
};

export type EngagementStats = {
  range: AdminStatsRange;
  trend: EngagementTrendStatItem[];
  summary: {
    comments: number;
    likes: number;
    total: number;
  };
  hasData: boolean;
};

export type DashboardStats = {
  range: AdminStatsRange;
  visits: VisitTrendStats;
  reading: ReadingStats;
  engagement: EngagementStats;
};

export type AdminTodoCounts = {
  pendingComments: number;
  failedAiTasks: number;
  staleDrafts: number;
  pendingNewsletters: number;
};

export type DashboardPeriodMetrics = {
  publishedPosts: number;
  readingMinutes: number;
  engagementRate: number;
  subscribers: number;
};

export type DashboardComparisonDeltas = {
  visits: number;
  publishedPosts: number;
  readingMinutes: number;
  engagementRate: number;
  subscribers: number;
};

export type DashboardStatsWithComparison = {
  current: DashboardStats;
  previous: DashboardStats;
  metrics: DashboardPeriodMetrics;
  previousMetrics: DashboardPeriodMetrics;
  deltas: DashboardComparisonDeltas;
};

type ReadingEventRecord = {
  date: Date | string;
  events: number | bigint | string;
  qualified: number | bigint | string;
  completed: number | bigint | string;
  durationSeconds: number | bigint | string | null;
};

type EngagementRecord = {
  date: Date | string;
  count: number | bigint | string;
};

type PrismaWithRawQueries = typeof prisma & {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export function parseAdminStatsRange(value: unknown): AdminStatsRange {
  return parseVisitTrendRange(value);
}

export function getAdminStatsRangeWindow(range: AdminStatsRange, now = new Date()) {
  const today = startOfUtcDay(now);

  return {
    today,
    yesterday: addUtcDays(today, -1),
    start: addUtcDays(today, -(range - 1)),
    end: addUtcDays(today, 1),
  };
}

function createDailyBuckets<T extends object>(range: AdminStatsRange, start: Date, init: () => T) {
  const buckets = new Map<string, T & { date: string; label: string }>();

  for (let index = 0; index < range; index += 1) {
    const date = addUtcDays(start, index);
    const dateKey = formatVisitTrendDate(date);
    buckets.set(dateKey, {
      date: dateKey,
      label: formatVisitTrendLabel(date),
      ...init(),
    });
  }

  return buckets;
}

function visitorKey(log: { visitorId: string | null; ipHash: string | null; userAgent: string | null }) {
  return log.visitorId || `${log.ipHash ?? "unknown-ip"}:${log.userAgent ?? "unknown-agent"}`;
}

function toCount(value: number | bigint | string | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function rawPrisma() {
  return prisma as PrismaWithRawQueries;
}

function subtractUtcDays(date: Date, days: number) {
  return addUtcDays(date, -days);
}

function getPreviousWindowNow(range: AdminStatsRange, now: Date) {
  return subtractUtcDays(getAdminStatsRangeWindow(range, now).today, range);
}

function getEngagementRate(stats: DashboardStats) {
  const visits = stats.visits.summary.totalPv;

  return visits > 0 ? stats.engagement.summary.total / visits : 0;
}

async function getDashboardPeriodMetrics(range: AdminStatsRange, now: Date): Promise<DashboardPeriodMetrics> {
  const { start, end } = getAdminStatsRangeWindow(range, now);
  const [publishedPosts, verifiedSubscribers, unsubscribedSubscribers] = await Promise.all([
    prisma.post.count({
      where: {
        deletedAt: null,
        published: true,
        publishedAt: { gte: start, lt: end },
      },
    }),
    prisma.newsletterSubscriber.count({
      where: {
        status: NEWSLETTER_STATUS_VERIFIED,
        unsubscribedAt: null,
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.newsletterSubscriber.count({
      where: {
        unsubscribedAt: { gte: start, lt: end },
      },
    }),
  ]);

  return {
    publishedPosts,
    readingMinutes: 0,
    engagementRate: 0,
    subscribers: verifiedSubscribers - unsubscribedSubscribers,
  };
}

export async function getAdminTodoCounts(now = new Date()): Promise<AdminTodoCounts> {
  const staleBefore = subtractUtcDays(now, ADMIN_TODO_WINDOW_DAYS);
  const [pendingComments, failedAiTasks, staleDrafts, pendingNewsletters] = await Promise.all([
    prisma.comment.count({ where: { deletedAt: null, status: PENDING_COMMENT_STATUS } }),
    prisma.aiTask.count({
      where: {
        status: { in: [AI_TASK_STATUSES.failed, AI_TASK_STATUSES.partialFailed] },
        finishedAt: { gte: staleBefore },
      },
    }),
    prisma.post.count({
      where: {
        deletedAt: null,
        published: false,
        updatedAt: { lt: staleBefore },
      },
    }),
    prisma.newsletterCampaign.count({
      where: {
        status: { in: [...PENDING_NEWSLETTER_STATUSES] },
      },
    }),
  ]);

  return {
    pendingComments,
    failedAiTasks,
    staleDrafts,
    pendingNewsletters,
  };
}

export async function getVisitTrendStats(rangeInput: unknown, now = new Date()): Promise<VisitTrendStats> {
  const range = parseAdminStatsRange(rangeInput);
  const { today, yesterday, start, end } = getAdminStatsRangeWindow(range, now);
  const logs = await findVisitLogsInRange(start, end);
  const buckets = createDailyBuckets(range, start, () => ({ pv: 0, visitors: new Set<string>() }));
  const totalVisitors = new Set<string>();

  for (const log of logs) {
    const dateKey = formatVisitTrendDate(startOfUtcDay(log.createdAt));
    const bucket = buckets.get(dateKey);
    const key = visitorKey(log);

    totalVisitors.add(key);
    if (!bucket) continue;

    bucket.pv += 1;
    bucket.visitors.add(key);
  }

  const trend = Array.from(buckets.values()).map((bucket) => ({
    date: bucket.date,
    label: bucket.label,
    pv: bucket.pv,
    uv: bucket.visitors.size,
  }));

  return {
    range,
    trend,
    summary: {
      totalPv: logs.length,
      totalUv: totalVisitors.size,
      todayPv: buckets.get(formatVisitTrendDate(today))?.pv ?? 0,
      yesterdayPv: buckets.get(formatVisitTrendDate(yesterday))?.pv ?? 0,
    },
    hasData: logs.length > 0,
  };
}

export async function getReadingStats(rangeInput: unknown, now = new Date()): Promise<ReadingStats> {
  const range = parseAdminStatsRange(rangeInput);
  const { start, end } = getAdminStatsRangeWindow(range, now);
  const events = await rawPrisma().$queryRawUnsafe<ReadingEventRecord[]>(
    `
      SELECT
        "readDate"::date AS "date",
        COUNT(*)::int AS "events",
        COUNT(*) FILTER (WHERE "qualified")::int AS "qualified",
        COUNT(*) FILTER (WHERE "scrollDepth" >= 85)::int AS "completed",
        COALESCE(SUM("durationSeconds"), 0)::int AS "durationSeconds"
      FROM "reading_events"
      WHERE "readDate" >= $1 AND "readDate" < $2
      GROUP BY "readDate"
      ORDER BY "readDate" ASC
    `,
    start,
    end,
  );
  const buckets = createDailyBuckets(range, start, () => ({
    events: 0,
    qualified: 0,
    completed: 0,
    durationSeconds: 0,
  }));

  let qualifiedEvents = 0;
  let completedEvents = 0;
  let totalDurationSeconds = 0;

  for (const event of events) {
    const dateKey = formatVisitTrendDate(startOfUtcDay(new Date(event.date)));
    const bucket = buckets.get(dateKey);
    const eventCount = toCount(event.events);
    const qualifiedCount = toCount(event.qualified);
    const completedCount = toCount(event.completed);
    const durationSeconds = toCount(event.durationSeconds);

    qualifiedEvents += qualifiedCount;
    completedEvents += completedCount;
    totalDurationSeconds += durationSeconds;

    if (!bucket) continue;

    bucket.events += eventCount;
    bucket.qualified += qualifiedCount;
    bucket.completed += completedCount;
    bucket.durationSeconds += durationSeconds;
  }
  const totalEvents = events.reduce((total, event) => total + toCount(event.events), 0);

  return {
    range,
    trend: Array.from(buckets.values()),
    summary: {
      totalEvents,
      qualifiedEvents,
      completedEvents,
      totalDurationSeconds,
      averageDurationSeconds: totalEvents > 0 ? Math.round(totalDurationSeconds / totalEvents) : 0,
    },
    hasData: totalEvents > 0,
  };
}

export async function getEngagementStats(rangeInput: unknown, now = new Date()): Promise<EngagementStats> {
  const range = parseAdminStatsRange(rangeInput);
  const { start, end } = getAdminStatsRangeWindow(range, now);
  const [comments, likes] = await Promise.all([
    rawPrisma().$queryRawUnsafe<EngagementRecord[]>(
      `
        SELECT DATE_TRUNC('day', "createdAt")::date AS "date", COUNT(*)::int AS "count"
        FROM "comments"
        WHERE "deletedAt" IS NULL AND "createdAt" >= $1 AND "createdAt" < $2
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      start,
      end,
    ),
    rawPrisma().$queryRawUnsafe<EngagementRecord[]>(
      `
        SELECT DATE_TRUNC('day', "createdAt")::date AS "date", COUNT(*)::int AS "count"
        FROM "likes"
        WHERE "createdAt" >= $1 AND "createdAt" < $2
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      start,
      end,
    ),
  ]);
  const buckets = createDailyBuckets(range, start, () => ({ comments: 0, likes: 0 }));
  let totalComments = 0;
  let totalLikes = 0;

  for (const comment of comments) {
    const count = toCount(comment.count);
    const bucket = buckets.get(formatVisitTrendDate(startOfUtcDay(new Date(comment.date))));
    totalComments += count;
    if (bucket) bucket.comments += count;
  }

  for (const like of likes) {
    const count = toCount(like.count);
    const bucket = buckets.get(formatVisitTrendDate(startOfUtcDay(new Date(like.date))));
    totalLikes += count;
    if (bucket) bucket.likes += count;
  }

  return {
    range,
    trend: Array.from(buckets.values()),
    summary: {
      comments: totalComments,
      likes: totalLikes,
      total: totalComments + totalLikes,
    },
    hasData: totalComments + totalLikes > 0,
  };
}

export async function getDashboardStats(rangeInput: unknown, now = new Date()): Promise<DashboardStats> {
  const range = parseAdminStatsRange(rangeInput);
  const [visits, reading, engagement] = await Promise.all([
    getVisitTrendStats(range, now),
    getReadingStats(range, now),
    getEngagementStats(range, now),
  ]);

  return {
    range,
    visits,
    reading,
    engagement,
  };
}

export async function getDashboardStatsWithComparison(rangeInput: unknown, now = new Date()): Promise<DashboardStatsWithComparison> {
  const range = parseAdminStatsRange(rangeInput);
  const previousNow = getPreviousWindowNow(range, now);
  const [current, previous, currentMetrics, previousMetrics] = await Promise.all([
    getDashboardStats(range, now),
    getDashboardStats(range, previousNow),
    getDashboardPeriodMetrics(range, now),
    getDashboardPeriodMetrics(range, previousNow),
  ]);
  const metrics = {
    ...currentMetrics,
    readingMinutes: Math.round(current.reading.summary.totalDurationSeconds / 60),
    engagementRate: getEngagementRate(current),
  };
  const priorMetrics = {
    ...previousMetrics,
    readingMinutes: Math.round(previous.reading.summary.totalDurationSeconds / 60),
    engagementRate: getEngagementRate(previous),
  };

  return {
    current,
    previous,
    metrics,
    previousMetrics: priorMetrics,
    deltas: {
      visits: current.visits.summary.totalPv - previous.visits.summary.totalPv,
      publishedPosts: metrics.publishedPosts - priorMetrics.publishedPosts,
      readingMinutes: metrics.readingMinutes - priorMetrics.readingMinutes,
      engagementRate: metrics.engagementRate - priorMetrics.engagementRate,
      subscribers: metrics.subscribers - priorMetrics.subscribers,
    },
  };
}
