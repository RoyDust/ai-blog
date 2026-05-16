import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const NEWSLETTER_STATUS_PENDING = "pending";
export const NEWSLETTER_STATUS_VERIFIED = "verified";
export const NEWSLETTER_STATUS_UNSUBSCRIBED = "unsubscribed";

const EMAIL_MAX_LENGTH = 254;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;
const UNSUBSCRIBE_TOKEN_PREFIX = "u";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
  source?: string | null;
};

type NewsletterSubscriber = {
  id: string;
  email: string;
  status: string;
  verificationToken: string | null;
  verifiedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type NewsletterSubscriberDelegate = {
  findUnique(args: unknown): Promise<NewsletterSubscriber | null>;
  findFirst(args: unknown): Promise<NewsletterSubscriber | null>;
  findMany(args: unknown): Promise<NewsletterSubscriber[]>;
  create(args: unknown): Promise<NewsletterSubscriber>;
  update(args: unknown): Promise<NewsletterSubscriber>;
};

type PrismaWithNewsletter = typeof prisma & {
  newsletterSubscriber: NewsletterSubscriberDelegate;
};

function newsletterClient() {
  return (prisma as PrismaWithNewsletter).newsletterSubscriber;
}

export function normalizeNewsletterEmail(email: unknown) {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!normalized) {
    throw new ValidationError("Email is required");
  }

  if (normalized.length > EMAIL_MAX_LENGTH || !emailPattern.test(normalized)) {
    throw new ValidationError("Valid email is required");
  }

  return normalized;
}

function normalizeToken(token: unknown) {
  const normalized = typeof token === "string" ? token.trim() : "";

  if (!normalized) {
    throw new ValidationError("Token is required");
  }

  return normalized;
}

function createVerificationToken() {
  return randomBytes(32).toString("base64url");
}

function getNewsletterTokenSecret() {
  return process.env.NEWSLETTER_TOKEN_SECRET?.trim() || process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
}

function signNewsletterPayload(payload: string) {
  const secret = getNewsletterTokenSecret();
  if (!secret) {
    throw new Error("Newsletter token secret is not configured");
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createNewsletterUnsubscribeToken(email: string) {
  const normalizedEmail = normalizeNewsletterEmail(email);
  const payload = Buffer.from(JSON.stringify({ email: normalizedEmail, purpose: "newsletter-unsubscribe" })).toString("base64url");
  const signature = signNewsletterPayload(payload);

  return `${UNSUBSCRIBE_TOKEN_PREFIX}.${payload}.${signature}`;
}

function readSignedUnsubscribeEmail(token: string) {
  const [prefix, payload, signature] = token.split(".");
  if (prefix !== UNSUBSCRIBE_TOKEN_PREFIX || !payload || !signature) {
    return null;
  }

  const expectedSignature = signNewsletterPayload(payload);
  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      purpose?: unknown;
    };

    if (parsed.purpose !== "newsletter-unsubscribe") {
      return null;
    }

    return normalizeNewsletterEmail(parsed.email);
  } catch {
    return null;
  }
}

export async function subscribe(email: string, requestContext: NewsletterRequestContext = {}) {
  const normalizedEmail = normalizeNewsletterEmail(email);
  const client = newsletterClient();
  const existing = await client.findUnique({ where: { email: normalizedEmail } });

  void requestContext;

  if (!existing) {
    return client.create({
      data: {
        email: normalizedEmail,
        status: NEWSLETTER_STATUS_PENDING,
        verificationToken: createVerificationToken(),
        verifiedAt: null,
        unsubscribedAt: null,
      },
    });
  }

  if (existing.status === NEWSLETTER_STATUS_UNSUBSCRIBED || existing.unsubscribedAt) {
    return client.update({
      where: { id: existing.id },
      data: {
        status: NEWSLETTER_STATUS_PENDING,
        verificationToken: createVerificationToken(),
        verifiedAt: null,
        unsubscribedAt: null,
      },
    });
  }

  return existing;
}

export async function verify(token: string) {
  const verificationToken = normalizeToken(token);
  const client = newsletterClient();
  const subscriber = await client.findUnique({ where: { verificationToken } });

  if (!subscriber || subscriber.status === NEWSLETTER_STATUS_UNSUBSCRIBED || subscriber.unsubscribedAt) {
    return null;
  }

  if (subscriber.status === NEWSLETTER_STATUS_VERIFIED) {
    return subscriber;
  }

  return client.update({
    where: { id: subscriber.id },
    data: {
      status: NEWSLETTER_STATUS_VERIFIED,
      verificationToken: null,
      verifiedAt: new Date(),
      unsubscribedAt: null,
    },
  });
}

export async function unsubscribe(tokenOrEmail: string) {
  const value = typeof tokenOrEmail === "string" ? tokenOrEmail.trim() : "";

  if (!value) {
    throw new ValidationError("Token is required");
  }

  const client = newsletterClient();
  const byToken = await client.findUnique({ where: { verificationToken: value } });
  const signedEmail = byToken ? null : readSignedUnsubscribeEmail(value);
  const subscriber = byToken ?? (signedEmail ? await client.findUnique({ where: { email: signedEmail } }) : null);

  if (!subscriber) {
    return null;
  }

  if (subscriber.status === NEWSLETTER_STATUS_UNSUBSCRIBED || subscriber.unsubscribedAt) {
    return subscriber;
  }

  return client.update({
    where: { id: subscriber.id },
    data: {
      status: NEWSLETTER_STATUS_UNSUBSCRIBED,
      verificationToken: null,
      unsubscribedAt: new Date(),
    },
  });
}

export async function listVerifiedSubscribers(batchSize = DEFAULT_BATCH_SIZE) {
  const take = Math.min(Math.max(Math.trunc(batchSize), 1), MAX_BATCH_SIZE);

  return newsletterClient().findMany({
    where: {
      status: NEWSLETTER_STATUS_VERIFIED,
      verifiedAt: { not: null },
      unsubscribedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}
