import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type VisitLogRecord = {
  createdAt: Date;
  visitorId: string | null;
  ipHash: string | null;
  userAgent: string | null;
};

export type PopularPostVisitRecord = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  publishedAt: Date | null;
  visitCount: number;
};

export type VisitLogCreateInput = {
  path: string;
  postId: string | null;
  referrer: string | null;
  visitorId: string | null;
  userAgent: string | null;
  ipHash: string | null;
};

const visitLogModel = () => (prisma as typeof prisma & { visitLog?: {
  findMany: (args: {
    where: { createdAt: { gte: Date; lt: Date } };
    select: { createdAt: true; visitorId: true; ipHash: true; userAgent: true };
    orderBy: { createdAt: "asc" };
  }) => Promise<VisitLogRecord[]>;
  create: (args: { data: VisitLogCreateInput }) => unknown;
} }).visitLog;

export async function findVisitLogsInRange(start: Date, end: Date) {
  const model = visitLogModel();

  if (model) {
    return model.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { createdAt: true, visitorId: true, ipHash: true, userAgent: true },
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.$queryRaw<VisitLogRecord[]>`
    SELECT "createdAt", "visitorId", "ipHash", "userAgent"
    FROM "visit_logs"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
    ORDER BY "createdAt" ASC
  `;
}

export async function findPopularPostVisitsInRange(start: Date, end: Date, take = 5) {
  const limit = Math.max(1, Math.min(20, Math.trunc(take)));

  return prisma.$queryRaw<PopularPostVisitRecord[]>`
    SELECT
      p."id",
      p."title",
      p."slug",
      p."coverImage",
      p."publishedAt",
      COUNT(v."id")::int AS "visitCount"
    FROM "visit_logs" v
    INNER JOIN "posts" p ON p."id" = v."postId"
    WHERE v."createdAt" >= ${start}
      AND v."createdAt" < ${end}
      AND v."postId" IS NOT NULL
      AND p."deletedAt" IS NULL
      AND p."published" = true
    GROUP BY p."id", p."title", p."slug", p."coverImage", p."publishedAt"
    ORDER BY "visitCount" DESC, p."publishedAt" DESC NULLS LAST, p."id" ASC
    LIMIT ${limit}
  `;
}

export function createVisitLogOperation(data: VisitLogCreateInput) {
  const model = visitLogModel();

  if (model) {
    return model.create({ data });
  }

  const id = `visit_${randomUUID()}`;

  return prisma.$executeRaw`
    INSERT INTO "visit_logs" ("id", "path", "postId", "referrer", "visitorId", "userAgent", "ipHash", "createdAt")
    VALUES (${id}, ${data.path}, ${data.postId}, ${data.referrer}, ${data.visitorId}, ${data.userAgent}, ${data.ipHash}, now())
  `;
}
