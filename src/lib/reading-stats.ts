import { prisma } from "@/lib/prisma";

const DEFAULT_MONTHLY_READING_GOAL = 30;
const MIN_MONTHLY_READING_GOAL = 1;
const MAX_MONTHLY_READING_GOAL = 999;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type UserReadingStats = {
  totalArticles: number;
  totalReadingMinutes: number;
  streakDays: number;
  monthlyRead: number;
  monthlyGoal: number;
  monthlyProgress: number;
};

type RawPrisma = typeof prisma & {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

type NumberRow = {
  value: number | bigint | string | null;
};

type ReadingTotalsRow = {
  totalArticles: number | bigint | string | null;
  totalReadingMinutes: number | bigint | string | null;
};

type DayRow = {
  day: string | Date;
};

function rawPrisma() {
  return prisma as RawPrisma;
}

function toInteger(value: unknown) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }

  return 0;
}

function numberFromRows(rows: NumberRow[] | undefined) {
  return Math.max(0, toInteger(rows?.[0]?.value));
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function normalizeDayKey(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function parseDayKey(day: string) {
  const [year, month, date] = day.split("-").map((part) => Number(part));
  if (!year || !month || !date) {
    return null;
  }

  return Date.UTC(year, month - 1, date);
}

export function normalizeMonthlyReadingGoal(value: unknown, fallback = DEFAULT_MONTHLY_READING_GOAL) {
  const numeric = Number(value);
  const candidate = Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;

  return Math.min(MAX_MONTHLY_READING_GOAL, Math.max(MIN_MONTHLY_READING_GOAL, candidate));
}

export function calculateReadingStreak(days: Array<string | Date>, now = new Date()) {
  const uniqueDays = Array.from(new Set(days.map(normalizeDayKey).filter(Boolean))).sort().reverse();
  if (uniqueDays.length === 0) {
    return 0;
  }

  let streak = 1;
  let previous = parseDayKey(uniqueDays[0]);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (previous === null) {
    return 0;
  }

  if (previous !== today) {
    return 0;
  }

  for (const day of uniqueDays.slice(1)) {
    const current = parseDayKey(day);
    if (current === null) {
      continue;
    }

    const diffDays = Math.round((previous - current) / DAY_IN_MS);
    if (diffDays !== 1) {
      break;
    }

    streak += 1;
    previous = current;
  }

  return streak;
}

function emptyStats(monthlyGoal: number): UserReadingStats {
  return {
    totalArticles: 0,
    totalReadingMinutes: 0,
    streakDays: 0,
    monthlyRead: 0,
    monthlyGoal,
    monthlyProgress: 0,
  };
}

function isMissingReadingStatsStorageError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "P2021" ||
    code === "P2022" ||
    message.includes('relation "reading_events" does not exist') ||
    message.includes('column "readDate" does not exist')
  );
}

export async function getUserReadingStats(userId: string, monthlyGoalInput: unknown, now = new Date()): Promise<UserReadingStats> {
  const monthlyGoal = normalizeMonthlyReadingGoal(monthlyGoalInput);
  const client = rawPrisma();

  const monthStart = startOfMonth(now);
  const monthEnd = startOfNextMonth(now);

  try {
    const [totalsRows, monthlyReadRows, streakRows] = await Promise.all([
      client.$queryRawUnsafe<ReadingTotalsRow[]>(
        `
          WITH read_posts AS (
            SELECT DISTINCT r."postId"
            FROM "reading_events" r
            INNER JOIN "posts" p ON p."id" = r."postId"
            WHERE r."userId" = $1
              AND r."qualified" = true
              AND p."deletedAt" IS NULL
              AND p."published" = true
          )
          SELECT
            COUNT(*)::int AS "totalArticles",
            COALESCE(SUM(p."readingTimeMinutes"), 0)::int AS "totalReadingMinutes"
          FROM read_posts
          INNER JOIN "posts" p ON p."id" = read_posts."postId"
        `,
        userId,
      ),
      client.$queryRawUnsafe<NumberRow[]>(
        `
          SELECT COUNT(*)::int AS "value"
          FROM (
            SELECT DISTINCT r."postId"
            FROM "reading_events" r
            INNER JOIN "posts" p ON p."id" = r."postId"
            WHERE r."userId" = $1
              AND r."qualified" = true
              AND r."readDate" >= $2
              AND r."readDate" < $3
              AND p."deletedAt" IS NULL
              AND p."published" = true
          ) monthly_read_posts
        `,
        userId,
        monthStart,
        monthEnd,
      ),
      client.$queryRawUnsafe<DayRow[]>(
        `
          SELECT DISTINCT r."readDate"::text AS "day"
          FROM "reading_events" r
          INNER JOIN "posts" p ON p."id" = r."postId"
          WHERE r."userId" = $1
            AND r."qualified" = true
            AND p."deletedAt" IS NULL
            AND p."published" = true
          ORDER BY "day" DESC
        `,
        userId,
      ),
    ]);

    const monthlyRead = numberFromRows(monthlyReadRows);
    const totals = totalsRows[0];

    return {
      totalArticles: Math.max(0, toInteger(totals?.totalArticles)),
      totalReadingMinutes: Math.max(0, toInteger(totals?.totalReadingMinutes)),
      streakDays: calculateReadingStreak(streakRows.map((row) => row.day), now),
      monthlyRead,
      monthlyGoal,
      monthlyProgress: Math.min(100, Math.round((monthlyRead / monthlyGoal) * 100)),
    };
  } catch (error) {
    if (!isMissingReadingStatsStorageError(error)) {
      console.error("Read user reading stats error:", error);
    }

    return emptyStats(monthlyGoal);
  }
}
