import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type VisitLogRecord = {
  createdAt: Date;
  visitorId: string | null;
  ipHash: string | null;
  userAgent: string | null;
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
