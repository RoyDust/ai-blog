import type { NewsletterSettings } from "@/lib/blog-settings";

export type NewsletterMailResult = {
  delivered: boolean;
  provider: "noop" | "log";
  reason?: "provider_not_configured";
};

export type NewsletterVerificationMessage = {
  email: string;
  verificationToken: string;
  verificationUrl?: string;
};

export interface NewsletterMailer {
  provider: "noop" | "log";
  configured: boolean;
  sendVerificationEmail(message: NewsletterVerificationMessage): Promise<NewsletterMailResult>;
}

type NewsletterMailerOptions = Pick<NewsletterSettings, "provider" | "fromEmail" | "replyTo">;

function createProviderNotConfiguredResult(): NewsletterMailResult {
  return {
    delivered: false,
    provider: "noop",
    reason: "provider_not_configured",
  };
}

function resolveProvider(options?: Partial<NewsletterMailerOptions>) {
  return options?.provider ?? process.env.NEWSLETTER_PROVIDER?.trim().toLowerCase();
}

function redactVerificationUrl(url: string | undefined) {
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

export function createNewsletterMailer(options?: Partial<NewsletterMailerOptions>): NewsletterMailer {
  const provider = resolveProvider(options);

  if (provider === "log") {
    return {
      provider: "log",
      configured: true,
      async sendVerificationEmail(message) {
        console.info("[newsletter] verification email", {
          email: message.email,
          fromEmail: options?.fromEmail || undefined,
          replyTo: options?.replyTo || undefined,
          verificationUrl: redactVerificationUrl(message.verificationUrl),
        });

        return {
          delivered: true,
          provider: "log",
        };
      },
    };
  }

  return {
    provider: "noop",
    configured: false,
    async sendVerificationEmail() {
      return createProviderNotConfiguredResult();
    },
  };
}
