import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import { getBlogSettings, type NewsletterSettings } from "@/lib/blog-settings";

export type NewsletterOutboundMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

function normalizeUnsubscribeHeaders(headers?: Record<string, string>) {
  if (!headers) {
    return undefined;
  }

  if (headers["List-Unsubscribe"] && !headers["List-Unsubscribe-Post"]) {
    return {
      ...headers,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  return { ...headers };
}

// Legacy `delivered` means adapter acceptance, not inbox delivery. False must mean
// definite nonacceptance; thrown/ambiguous outcomes are handled as unknown by the sender.
export async function sendNewsletterEmail(message: NewsletterOutboundMessage, settings?: NewsletterSettings) {
  const newsletter = settings ?? (await getBlogSettings()).newsletter;
  const normalizedHeaders = normalizeUnsubscribeHeaders(message.headers);
  const outboundMessage: NewsletterOutboundMessage = normalizedHeaders
    ? { ...message, headers: normalizedHeaders }
    : message;
  const mailer = createNewsletterMailer(newsletter) as ReturnType<typeof createNewsletterMailer> & {
    sendCampaignEmail?: (message: NewsletterOutboundMessage) => Promise<unknown>;
  };

  if (typeof mailer.sendCampaignEmail === "function") {
    return mailer.sendCampaignEmail(outboundMessage);
  }

  if (mailer.provider === "log") {
    console.info("[newsletter] campaign email", {
      to: outboundMessage.to,
      subject: outboundMessage.subject,
      htmlLength: outboundMessage.html.length,
      textLength: outboundMessage.text.length,
    });

    return { delivered: true, provider: "log" as const, simulated: true };
  }

  return { delivered: false, provider: "noop" as const, reason: "provider_not_configured" as const };
}
