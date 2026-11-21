import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { isPrismaConflictError, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const NEWSLETTER_STATUS_PENDING = "pending";
export const NEWSLETTER_STATUS_VERIFIED = "verified";
export const NEWSLETTER_STATUS_UNSUBSCRIBED = "unsubscribed";
export const NEWSLETTER_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

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
  updateMany?(args: unknown): Promise<{ count: number }>;
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

function hasOneClickUnsubscribeMarker(entries: Iterable<[string, FormDataEntryValue | string]>): boolean {
  for (const [key, value] of entries) {
    if (key.trim().toLowerCase() === "list-unsubscribe" && typeof value === "string") {
      if (value.trim().toLowerCase() === "one-click") {
        return true;
      }
    }
  }

  return false;
}

export async function extractNewsletterRequestToken(request: Request): Promise<string> {
  const urlToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const formToken = formData?.get("token");
    if (typeof formToken === "string" && formToken.trim()) {
      return formToken.trim();
    }
    return urlToken;
  }

  const rawBody = await request.text().catch(() => "");
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return urlToken;
  }

  if (contentType.includes("application/json") || trimmedBody.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmedBody) as { token?: unknown };
      if (typeof parsed?.token === "string" && parsed.token.trim()) {
        return parsed.token.trim();
      }
    } catch {
      return urlToken;
    }
    return urlToken;
  }

  const bodyToken = new URLSearchParams(trimmedBody).get("token")?.trim();
  return bodyToken || urlToken;
}

export async function extractNewsletterUnsubscribeToken(request: Request): Promise<string> {
  const urlToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return "";
    }
    const formToken = formData.get("token");
    if (typeof formToken === "string" && formToken.trim()) {
      return formToken.trim();
    }
    return hasOneClickUnsubscribeMarker(formData.entries()) ? urlToken : "";
  }

  const rawBody = await request.text().catch(() => "");
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return "";
  }

  if (contentType.includes("application/json") || trimmedBody.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmedBody) as { token?: unknown };
      if (typeof parsed?.token === "string" && parsed.token.trim()) {
        return parsed.token.trim();
      }
    } catch {
      return "";
    }
    return "";
  }

  const params = new URLSearchParams(trimmedBody);
  const bodyToken = params.get("token")?.trim();
  if (bodyToken) {
    return bodyToken;
  }

  return hasOneClickUnsubscribeMarker(params.entries()) ? urlToken : "";
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
    try {
      return await client.create({
        data: {
          email: normalizedEmail,
          status: NEWSLETTER_STATUS_PENDING,
          verificationToken: createVerificationToken(),
          verifiedAt: null,
          unsubscribedAt: null,
        },
      });
    } catch (error) {
      if (!isPrismaConflictError(error)) {
        throw error;
      }

      const raced = await client.findUnique({ where: { email: normalizedEmail } });
      if (!raced) {
        throw error;
      }

      if (raced.status === NEWSLETTER_STATUS_UNSUBSCRIBED || raced.unsubscribedAt) {
        return client.update({
          where: { id: raced.id },
          data: {
            status: NEWSLETTER_STATUS_PENDING,
            verificationToken: createVerificationToken(),
            verifiedAt: null,
            unsubscribedAt: null,
            updatedAt: new Date(),
          },
        });
      }

      return raced;
    }
  }

  if (
    existing.status === NEWSLETTER_STATUS_PENDING ||
    existing.status === NEWSLETTER_STATUS_UNSUBSCRIBED ||
    existing.unsubscribedAt
  ) {
    return client.update({
      where: { id: existing.id },
      data: {
        status: NEWSLETTER_STATUS_PENDING,
        verificationToken: createVerificationToken(),
        verifiedAt: null,
        unsubscribedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  return existing;
}

export async function verify(token: string, now: Date = new Date()) {
  const verificationToken = normalizeToken(token);
  const client = newsletterClient();
  const subscriber = await client.findUnique({ where: { verificationToken } });

  if (!subscriber || subscriber.status === NEWSLETTER_STATUS_UNSUBSCRIBED || subscriber.unsubscribedAt) {
    return null;
  }

  if (subscriber.status === NEWSLETTER_STATUS_VERIFIED) {
    return subscriber;
  }

  if (subscriber.status !== NEWSLETTER_STATUS_PENDING) {
    return null;
  }

  const issuedAt = subscriber.updatedAt ?? subscriber.createdAt;
  const ttlCutoff = issuedAt instanceof Date ? new Date(now.getTime() - NEWSLETTER_VERIFICATION_TTL_MS) : null;
  if (issuedAt instanceof Date && ttlCutoff && issuedAt.getTime() < ttlCutoff.getTime()) {
    throw new ValidationError("验证链接已过期，请重新提交订阅申请");
  }

  if (typeof client.updateMany === "function") {
    const updated = await client.updateMany({
      where: {
        id: subscriber.id,
        verificationToken,
        status: NEWSLETTER_STATUS_PENDING,
        unsubscribedAt: null,
        ...(ttlCutoff
          ? {
              OR: [
                { updatedAt: { gte: ttlCutoff } },
                { createdAt: { gte: ttlCutoff } },
              ],
            }
          : {}),
      },
      data: {
        status: NEWSLETTER_STATUS_VERIFIED,
        verificationToken: null,
        verifiedAt: now,
        unsubscribedAt: null,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const refreshed = await client.findUnique({ where: { id: subscriber.id } });
    if (refreshed && (refreshed.status === NEWSLETTER_STATUS_UNSUBSCRIBED || refreshed.unsubscribedAt)) {
      return null;
    }

    return (
      refreshed ?? {
        ...subscriber,
        status: NEWSLETTER_STATUS_VERIFIED,
        verificationToken: null,
        verifiedAt: now,
        unsubscribedAt: null,
      }
    );
  }

  return client.update({
    where: { id: subscriber.id },
    data: {
      status: NEWSLETTER_STATUS_VERIFIED,
      verificationToken: null,
      verifiedAt: now,
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

export async function listVerifiedSubscribers(batchSize = DEFAULT_BATCH_SIZE, cursorId?: string | null) {
  const take = Math.min(Math.max(Math.trunc(batchSize), 1), MAX_BATCH_SIZE);

  return newsletterClient().findMany({
    where: {
      status: NEWSLETTER_STATUS_VERIFIED,
      verifiedAt: { not: null },
      unsubscribedAt: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    take,
  });
}
