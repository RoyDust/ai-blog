import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { unsubscribe } from "@/lib/newsletter";
import { checkInteractionRateLimit } from "@/lib/rate-limit";

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      throw new ValidationError("Token is required");
    }

    const subscriber = await unsubscribe(token);

    return NextResponse.json({
      success: true,
      data: {
        unsubscribed: Boolean(subscriber),
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Newsletter unsubscribe failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "public",
  operation: "public.newsletter.unsubscribe",
  route: "/api/newsletter/unsubscribe",
});
