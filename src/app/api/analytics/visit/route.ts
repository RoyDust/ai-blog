import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { extractPostSlugFromPath, normalizeAnalyticsPath, shouldTrackVisitPath } from "@/lib/analytics";
import { toErrorResponse, TooManyRequestsError, ValidationError } from "@/lib/api-errors";
import { getClientIpFromHeaders, hashIp } from "@/lib/api-operation-logs";
import { prisma } from "@/lib/prisma";
import { checkAnalyticsRateLimit } from "@/lib/rate-limit";
import { readSessionUserId } from "@/lib/session-token";
import { createVisitLogOperation } from "@/lib/visit-log-repository";

const MAX_REFERRER_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_VISITOR_ID_LENGTH = 120;

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeReferrer(rawReferrer: unknown): string | null {
  if (typeof rawReferrer !== "string") {
    return null;
  }

  const trimmed = rawReferrer.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    try {
      return new URL(trimmed, "http://localhost").pathname;
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const rawBeforeQueryOrHash = trimmed.split(/[?#]/, 1)[0] ?? "";
    const pathname =
      parsed.pathname === "/" && !rawBeforeQueryOrHash.endsWith("/") ? "" : parsed.pathname;

    return `${parsed.origin}${pathname}`;
  } catch {
    return null;
  }
}

async function POSTHandler(request: Request) {
  try {
    const payload: unknown = await request.json().catch(() => {
      throw new ValidationError("Invalid JSON body");
    });

    const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const path = normalizeAnalyticsPath(body.path);

    if (!path) {
      throw new ValidationError("Valid path is required");
    }

    if (!shouldTrackVisitPath(path)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const rateLimit = await checkAnalyticsRateLimit(request);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError("Too many analytics requests");
    }

    const referrer = truncate(sanitizeReferrer(body.referrer), MAX_REFERRER_LENGTH);
    const visitorId = truncate(typeof body.visitorId === "string" ? body.visitorId : null, MAX_VISITOR_ID_LENGTH);
    const userAgent = truncate(request.headers.get("user-agent"), MAX_USER_AGENT_LENGTH);
    const ipHash = hashIp(getClientIpFromHeaders(request.headers));
    const postSlug = extractPostSlugFromPath(path);
    const userId = await readSessionUserId(request);

    const post = postSlug
      ? await prisma.post.findFirst({
          where: { slug: postSlug, deletedAt: null, published: true },
          select: { id: true },
        })
      : null;

    await createVisitLogOperation({
      path,
      postId: post?.id ?? null,
      userId,
      referrer,
      visitorId,
      userAgent,
      ipHash,
    });

    if (post) {
      await prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'analytics', operation: 'analytics.visit.create', route: '/api/analytics/visit' });
