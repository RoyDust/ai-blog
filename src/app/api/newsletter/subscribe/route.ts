import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { ForbiddenError, toErrorResponse } from "@/lib/api-errors";
import { getBlogSettings } from "@/lib/blog-settings";
import { getSiteUrl } from "@/lib/seo";
import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import { normalizeNewsletterEmail, subscribe } from "@/lib/newsletter";
import { checkInteractionRateLimit } from "@/lib/rate-limit";

function getRequestContext(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  return {
    ip: forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkInteractionRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeNewsletterEmail(body.email);
    const settings = await getBlogSettings();
    if (!settings.newsletter.enabled) {
      throw new ForbiddenError("Newsletter subscription is disabled");
    }

    const subscriber = await subscribe(email, getRequestContext(request));
    const verificationUrl = subscriber.verificationToken
      ? `${getSiteUrl()}/api/newsletter/verify?token=${encodeURIComponent(subscriber.verificationToken)}`
      : null;
    const mailResult = subscriber.verificationToken
      ? await createNewsletterMailer(settings.newsletter).sendVerificationEmail({
          email: subscriber.email,
          verificationToken: subscriber.verificationToken,
          verificationUrl: verificationUrl ?? undefined,
        })
      : null;

    return NextResponse.json({
      success: true,
      data: {
        email: subscriber.email,
        status: subscriber.status,
        verificationRequired: Boolean(subscriber.verificationToken),
        mail: mailResult,
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
