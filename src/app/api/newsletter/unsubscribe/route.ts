import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse, TooManyRequestsError, ValidationError } from "@/lib/api-errors";
import { extractNewsletterRequestToken, unsubscribe } from "@/lib/newsletter";
import { checkInteractionRateLimit } from "@/lib/rate-limit";

async function GETHandler(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const token = requestUrl.searchParams.get("token")?.trim();
    const targetUrl = new URL("/newsletter/unsubscribe", requestUrl.origin);
    if (token) {
      targetUrl.searchParams.set("token", token);
    }

    return NextResponse.redirect(targetUrl, 302);
  } catch (error) {
    return toErrorResponse(error, "Newsletter unsubscribe failed");
  }
}

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError();
    }

    const token = await extractNewsletterRequestToken(request);
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

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.newsletter.unsubscribe.redirect",
  route: "/api/newsletter/unsubscribe",
});

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "public",
  operation: "public.newsletter.unsubscribe",
  route: "/api/newsletter/unsubscribe",
});
