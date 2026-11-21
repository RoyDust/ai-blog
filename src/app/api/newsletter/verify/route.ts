import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NotFoundError, toErrorResponse, TooManyRequestsError, ValidationError } from "@/lib/api-errors";
import { extractNewsletterRequestToken, verify } from "@/lib/newsletter";
import { checkInteractionRateLimit } from "@/lib/rate-limit";

async function GETHandler(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const token = requestUrl.searchParams.get("token")?.trim();
    const targetUrl = new URL("/newsletter/verify", requestUrl.origin);
    if (token) {
      targetUrl.searchParams.set("token", token);
    }

    return NextResponse.redirect(targetUrl, 302);
  } catch (error) {
    return toErrorResponse(error, "Newsletter verification failed");
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

    const subscriber = await verify(token);
    if (!subscriber) {
      throw new NotFoundError("验证链接无效或已被使用");
    }

    return NextResponse.json({
      success: true,
      data: {
        verified: true,
        status: subscriber.status,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Newsletter verification failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.newsletter.verify.redirect",
  route: "/api/newsletter/verify",
});

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "public",
  operation: "public.newsletter.verify",
  route: "/api/newsletter/verify",
});
