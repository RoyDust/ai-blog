import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import { getBlogSettings, type NewsletterSettings } from "@/lib/blog-settings";

export type NewsletterOutboundMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Legacy `delivered` means adapter acceptance, not inbox delivery. False must mean
// definite nonacceptance; thrown/ambiguous outcomes are handled as unknown by the sender.
export async function sendNewsletterEmail(message: NewsletterOutboundMessage, settings?: NewsletterSettings) {
  const newsletter = settings ?? (await getBlogSettings()).newsletter;
  const mailer = createNewsletterMailer(newsletter) as ReturnType<typeof createNewsletterMailer> & {
    sendCampaignEmail?: (message: NewsletterOutboundMessage) => Promise<unknown>;
  };

  if (typeof mailer.sendCampaignEmail === "function") {
    return mailer.sendCampaignEmail(message);
  }

  if (mailer.provider === "log") {
    console.info("[newsletter] campaign email", {
      to: message.to,
      subject: message.subject,
      htmlLength: message.html.length,
      textLength: message.text.length,
    });

    return { delivered: true, provider: "log" as const, simulated: true };
  }

  return { delivered: false, provider: "noop" as const, reason: "provider_not_configured" as const };
}
