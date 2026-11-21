import type { NewsletterSettings } from "@/lib/blog-settings";

export type NewsletterMailResult = {
  delivered: boolean;
  provider: "noop" | "log";
  reason?: "provider_not_configured";
};

export type NewsletterCampaignMailResult = {
  delivered: boolean;
  provider: "noop" | "log";
  simulated?: boolean;
  reason?: "provider_not_configured";
};

export type NewsletterVerificationMessage = {
  email: string;
  verificationToken: string;
  verificationUrl?: string;
};

export type NewsletterCampaignMailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export interface NewsletterMailer {
  provider: "noop" | "log";
  configured: boolean;
  simulated?: boolean;
  sendVerificationEmail(message: NewsletterVerificationMessage): Promise<NewsletterMailResult>;
  sendCampaignEmail?(message: NewsletterCampaignMailMessage): Promise<NewsletterCampaignMailResult>;
}

type NewsletterMailerOptions = {
  provider?: NewsletterSettings["provider"] | string;
  fromEmail?: string;
  replyTo?: string;
};

function createProviderNotConfiguredResult(): NewsletterMailResult {
  return {
    delivered: false,
    provider: "noop",
    reason: "provider_not_configured",
  };
}

function resolveProvider(options?: Partial<NewsletterMailerOptions>): "log" | "noop" {
  const raw = (options?.provider ?? process.env.NEWSLETTER_PROVIDER ?? "").trim().toLowerCase();

  if (raw === "log") {
    return "log";
  }

  if (raw === "console") {
    console.warn(
      '[newsletter] NEWSLETTER_PROVIDER="console" 已弃用，已按 "log" 本地模拟发送器处理；请更新为 NEWSLETTER_PROVIDER="log"',
    );
    return "log";
  }

  return "noop";
}

function redactTokenUrl(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "[redacted]");
    }
    return parsed.toString();
  } catch {
    return "[redacted]";
  }
}

function redactListUnsubscribeHeader(headerValue: string | undefined) {
  if (!headerValue) {
    return undefined;
  }

  const trimmed = headerValue.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const redacted = redactTokenUrl(trimmed.slice(1, -1));
    return redacted ? `<${redacted}>` : "<[redacted]>";
  }

  return redactTokenUrl(trimmed);
}

export function createNewsletterMailer(options?: Partial<NewsletterMailerOptions>): NewsletterMailer {
  const provider = resolveProvider(options);

  if (provider === "log") {
    return {
      provider: "log",
      configured: true,
      simulated: true,
      async sendVerificationEmail(message) {
        console.info("[newsletter] verification email", {
          email: message.email,
          fromEmail: options?.fromEmail || undefined,
          replyTo: options?.replyTo || undefined,
          verificationUrl: redactTokenUrl(message.verificationUrl),
        });

        return {
          delivered: true,
          provider: "log",
        };
      },
      async sendCampaignEmail(message) {
        const listUnsubscribe = redactListUnsubscribeHeader(message.headers?.["List-Unsubscribe"]);
        const listUnsubscribePost = message.headers?.["List-Unsubscribe-Post"];

        console.info("[newsletter] campaign email", {
          to: message.to,
          fromEmail: options?.fromEmail || undefined,
          replyTo: options?.replyTo || undefined,
          subject: message.subject,
          htmlLength: message.html.length,
          textLength: message.text.length,
          ...(listUnsubscribe ? { listUnsubscribe } : {}),
          ...(listUnsubscribePost ? { listUnsubscribePost } : {}),
        });

        return {
          delivered: true,
          provider: "log",
          simulated: true,
        };
      },
    };
  }

  return {
    provider: "noop",
    configured: false,
    simulated: false,
    async sendVerificationEmail() {
      return createProviderNotConfiguredResult();
    },
    async sendCampaignEmail() {
      return createProviderNotConfiguredResult();
    },
  };
}
