import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { getClientIpFromHeaders } from "@/lib/api-operation-logs";
import { ForbiddenError, toErrorResponse, TooManyRequestsError } from "@/lib/api-errors";
import { getBlogSettings } from "@/lib/blog-settings";
import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import { buildNewsletterVerifyUrl } from "@/lib/newsletter-renderer";
import { normalizeNewsletterEmail, subscribe } from "@/lib/newsletter";
import { checkInteractionRateLimit } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/seo";

const SUBSCRIBE_CONFIRMATION_MESSAGE = "订阅请求已提交，请检查邮箱完成确认。";

function getRequestContext(request: Request) {
  return {
    ip: getClientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
  };
}

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request);
    if (!rateLimit.allowed) {
      throw new TooManyRequestsError();
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeNewsletterEmail(body.email);
    const settings = await getBlogSettings();
    if (!settings.newsletter.enabled) {
      throw new ForbiddenError("Newsletter subscription is disabled");
    }

    const subscriber = await subscribe(email, getRequestContext(request));
    if (subscriber.verificationToken) {
      const verificationUrl = buildNewsletterVerifyUrl(getSiteUrl(), subscriber.verificationToken);
      await createNewsletterMailer(settings.newsletter).sendVerificationEmail({
        email: subscriber.email,
        verificationToken: subscriber.verificationToken,
        verificationUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: SUBSCRIBE_CONFIRMATION_MESSAGE,
      data: {
        accepted: true,
        message: SUBSCRIBE_CONFIRMATION_MESSAGE,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Newsletter subscription failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "public",
  operation: "public.newsletter.subscribe",
  route: "/api/newsletter/subscribe",
});
