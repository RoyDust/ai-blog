import { randomUUID } from "node:crypto";

import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  isQualifiedReadingEventInput,
  normalizeReadingDurationSeconds,
  normalizeReadingScrollDepth,
} from "@/lib/reading-thresholds";

export type RecordQualifiedReadingEventInput = {
  userId: string;
  postId: string;
  durationSeconds: unknown;
  scrollDepth: unknown;
  now?: Date;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function recordQualifiedReadingEvent(input: RecordQualifiedReadingEventInput) {
  const durationSeconds = normalizeReadingDurationSeconds(input.durationSeconds);
  const scrollDepth = normalizeReadingScrollDepth(input.scrollDepth);

  if (!isQualifiedReadingEventInput(durationSeconds, scrollDepth)) {
    throw new ValidationError("有效阅读条件不足");
  }

  const post = await prisma.post.findFirst({
    where: {
      id: input.postId,
      deletedAt: null,
      published: true,
    },
    select: { id: true },
  });

  if (!post) {
    throw new NotFoundError("Post not found");
  }

  const id = `read_${randomUUID()}`;
  const readDate = startOfUtcDay(input.now ?? new Date());

  await prisma.$executeRaw`
    INSERT INTO "reading_events" (
      "id",
      "userId",
      "postId",
      "readDate",
      "durationSeconds",
      "scrollDepth",
      "qualified",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${id},
      ${input.userId},
      ${post.id},
      ${readDate},
      ${durationSeconds},
      ${scrollDepth},
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "postId", "readDate")
    DO UPDATE SET
      "durationSeconds" = GREATEST("reading_events"."durationSeconds", EXCLUDED."durationSeconds"),
      "scrollDepth" = GREATEST("reading_events"."scrollDepth", EXCLUDED."scrollDepth"),
      "qualified" = true,
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return {
    postId: post.id,
    readDate,
    durationSeconds,
    scrollDepth,
  };
}
