import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: prismaMocks,
  },
}));

import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import {
  NEWSLETTER_STATUS_PENDING,
  NEWSLETTER_STATUS_UNSUBSCRIBED,
  NEWSLETTER_STATUS_VERIFIED,
  createNewsletterUnsubscribeToken,
  listVerifiedSubscribers,
  subscribe,
  unsubscribe,
  verify,
} from "@/lib/newsletter";

function subscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    email: "reader@example.com",
    status: NEWSLETTER_STATUS_PENDING,
    verificationToken: "token-1",
    verifiedAt: null,
    unsubscribedAt: null,
    createdAt: new Date("2026-05-16T00:00:00.000Z"),
    updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    ...overrides,
  };
}

describe("newsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEWSLETTER_PROVIDER;
    process.env.AUTH_SECRET = "newsletter-test-secret";
  });

  test("creates pending subscriptions with non-guessable verification tokens", async () => {
    prismaMocks.findUnique.mockResolvedValueOnce(null);
    prismaMocks.create.mockImplementationOnce(async (args) => subscriber(args.data));

    const result = await subscribe(" Reader@Example.com ", { ip: "127.0.0.1" });

    expect(result.email).toBe("reader@example.com");
    expect(result.status).toBe(NEWSLETTER_STATUS_PENDING);
    expect(result.verificationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "reader@example.com",
        status: NEWSLETTER_STATUS_PENDING,
        verificationToken: expect.any(String),
      }),
    });
  });

  test("duplicate subscribe is idempotent for pending and verified subscribers", async () => {
    const pending = subscriber();
    prismaMocks.findUnique.mockResolvedValueOnce(pending);

    await expect(subscribe("reader@example.com")).resolves.toBe(pending);
    expect(prismaMocks.update).not.toHaveBeenCalled();

    const verified = subscriber({ status: NEWSLETTER_STATUS_VERIFIED, verificationToken: null, verifiedAt: new Date() });
    prismaMocks.findUnique.mockResolvedValueOnce(verified);

    await expect(subscribe("reader@example.com")).resolves.toBe(verified);
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  test("reactivates unsubscribed email as pending with a new token", async () => {
    const unsubscribed = subscriber({
      status: NEWSLETTER_STATUS_UNSUBSCRIBED,
      verificationToken: null,
      unsubscribedAt: new Date(),
    });
    prismaMocks.findUnique.mockResolvedValueOnce(unsubscribed);
    prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ ...unsubscribed, ...args.data }));

    const result = await subscribe("reader@example.com");

    expect(result.status).toBe(NEWSLETTER_STATUS_PENDING);
    expect(result.unsubscribedAt).toBeNull();
    expect(result.verificationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(result.verificationToken).not.toBe(unsubscribed.verificationToken);
  });

  test("verifies pending subscribers by token", async () => {
    prismaMocks.findUnique.mockResolvedValueOnce(subscriber());
    prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ ...args.data }));

    const result = await verify("token-1");

    expect(result?.status).toBe(NEWSLETTER_STATUS_VERIFIED);
    expect(result?.verificationToken).toBeNull();
    expect(result?.verifiedAt).toBeInstanceOf(Date);
  });

  test("unsubscribe accepts verification tokens and signed unsubscribe tokens", async () => {
    prismaMocks.findUnique.mockResolvedValueOnce(subscriber({ id: "token-match", email: "token@example.com" }));
    prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ id: args.where.id, ...args.data }));

    const tokenResult = await unsubscribe("token-1");

    expect(tokenResult?.status).toBe(NEWSLETTER_STATUS_UNSUBSCRIBED);
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({ where: { verificationToken: "token-1" } });

    const unsubscribeToken = createNewsletterUnsubscribeToken("reader@example.com");
    prismaMocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subscriber({ id: "email-match", email: "reader@example.com" }));
    prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ id: args.where.id, ...args.data }));

    await unsubscribe(unsubscribeToken);

    expect(prismaMocks.findUnique).toHaveBeenLastCalledWith({ where: { email: "reader@example.com" } });
  });

  test("unsubscribe does not treat raw email as an authorization token", async () => {
    prismaMocks.findUnique.mockResolvedValueOnce(null);

    await expect(unsubscribe("reader@example.com")).resolves.toBeNull();

    expect(prismaMocks.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({ where: { verificationToken: "reader@example.com" } });
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  test("listVerifiedSubscribers excludes unsubscribed and unverified rows at the query boundary", async () => {
    prismaMocks.findMany.mockResolvedValueOnce([subscriber({ status: NEWSLETTER_STATUS_VERIFIED, verificationToken: null, verifiedAt: new Date() })]);

    await listVerifiedSubscribers(25);

    expect(prismaMocks.findMany).toHaveBeenCalledWith({
      where: {
        status: NEWSLETTER_STATUS_VERIFIED,
        verifiedAt: { not: null },
        unsubscribedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 25,
    });
  });

  test("listVerifiedSubscribers can continue after a cursor", async () => {
    prismaMocks.findMany.mockResolvedValueOnce([]);

    await listVerifiedSubscribers(25, "sub-25");

    expect(prismaMocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: "sub-25" },
      skip: 1,
      take: 25,
    }));
  });

  test("newsletter mailer is predictable when provider is not configured", async () => {
    const mailer = createNewsletterMailer();

    await expect(
      mailer.sendVerificationEmail({
        email: "reader@example.com",
        verificationToken: "token-1",
      }),
    ).resolves.toEqual({
      delivered: false,
      provider: "noop",
      reason: "provider_not_configured",
    });
    expect(mailer.configured).toBe(false);
  });

  test("log mailer redacts verification tokens from diagnostic output", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const mailer = createNewsletterMailer({ provider: "log", fromEmail: "news@example.com", replyTo: "reply@example.com" });

    await expect(
      mailer.sendVerificationEmail({
        email: "reader@example.com",
        verificationToken: "token-1",
        verificationUrl: "https://blog.example/api/newsletter/verify?token=token-1",
      }),
    ).resolves.toEqual({
      delivered: true,
      provider: "log",
    });

    expect(info).toHaveBeenCalledWith("[newsletter] verification email", {
      email: "reader@example.com",
      fromEmail: "news@example.com",
      replyTo: "reply@example.com",
      verificationUrl: "https://blog.example/api/newsletter/verify?token=%5Bredacted%5D",
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("token-1");
    info.mockRestore();
  });
});
