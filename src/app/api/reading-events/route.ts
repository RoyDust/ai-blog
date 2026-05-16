import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { requireSession } from "@/lib/api-auth";
import { checkInteractionRateLimit } from "@/lib/rate-limit";
import { recordQualifiedReadingEvent } from "@/lib/reading-events";

const POST_ID_PATTERN = /^c[a-z0-9]{23,24}$/i;

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const postId = typeof payload.postId === "string" ? payload.postId.trim() : "";

    if (!postId || !POST_ID_PATTERN.test(postId)) {
      return NextResponse.json({ error: "Valid postId is required" }, { status: 400 });
    }

    const readingEvent = await recordQualifiedReadingEvent({
      userId: session.user.id,
      postId,
      durationSeconds: payload.durationSeconds,
      scrollDepth: payload.scrollDepth,
    });

    return NextResponse.json({
      ok: true,
      recorded: true,
      data: {
        postId: readingEvent.postId,
        durationSeconds: readingEvent.durationSeconds,
        scrollDepth: readingEvent.scrollDepth,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Reading event record failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "public",
  operation: "public.reading-events.create",
  route: "/api/reading-events",
});
