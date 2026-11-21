import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: prismaMocks,
  },
}));

import { ValidationError } from "@/lib/api-errors";
import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import {
  NEWSLETTER_STATUS_PENDING,
  NEWSLETTER_STATUS_UNSUBSCRIBED,
  NEWSLETTER_STATUS_VERIFIED,
  NEWSLETTER_VERIFICATION_TTL_MS,
  createNewsletterUnsubscribeToken,
  listVerifiedSubscribers,
  subscribe,
  unsubscribe,
  verify,
} from "@/lib/newsletter";

function subscriber(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "sub-1",
    email: "reader@example.com",
    status: NEWSLETTER_STATUS_PENDING,
    verificationToken: "token-1",
    verifiedAt: null,
    unsubscribedAt: null,
    createdAt: now,
    updatedAt: now,
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

  test("re-subscribing refreshes token/timestamp for pending subscribers while keeping verified subscribers intact", async () => {
    const expiredDate = new Date(Date.now() - NEWSLETTER_VERIFICATION_TTL_MS - 60_000);
    const pending = subscriber({ verificationToken: "old-token", createdAt: expiredDate, updatedAt: expiredDate });
    prismaMocks.findUnique.mockResolvedValueOnce(pending);
    prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ ...pending, ...args.data }));

    const refreshed = await subscribe("reader@example.com");
    expect(prismaMocks.update).toHaveBeenCalledTimes(1);
    expect(refreshed.status).toBe(NEWSLETTER_STATUS_PENDING);
    expect(refreshed.verificationToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(refreshed.verificationToken).not.toBe("old-token");
    expect(refreshed.updatedAt.getTime()).toBeGreaterThan(expiredDate.getTime());

    vi.clearAllMocks();
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

  test("recovers cleanly from P2002 unique constraint race on concurrent first-time subscribe", async () => {
    const racedPending = subscriber({ email: "race@example.com", verificationToken: "winner-token" });
    prismaMocks.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(racedPending);
    prismaMocks.create.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
        code: "P2002",
        meta: { target: ["email"] },
      }),
    );

    const result = await subscribe("Race@Example.com");

    expect(result).toBe(racedPending);
    expect(prismaMocks.findUnique).toHaveBeenCalledTimes(2);
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  test("verifies pending subscribers within the 48h window via atomic conditional updateMany", async () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const recent = new Date(now.getTime() - 47 * 60 * 60 * 1000);
    const pendingRow = subscriber({ id: "sub-atomic", verificationToken: "token-1", createdAt: recent, updatedAt: recent });
    const verifiedRow = subscriber({
      id: "sub-atomic",
      status: NEWSLETTER_STATUS_VERIFIED,
      verificationToken: null,
      verifiedAt: now,
      unsubscribedAt: null,
      createdAt: recent,
      updatedAt: now,
    });
    prismaMocks.findUnique
      .mockResolvedValueOnce(pendingRow)
      .mockResolvedValueOnce(verifiedRow);
    prismaMocks.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await verify("token-1", now);

    expect(prismaMocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sub-atomic",
        verificationToken: "token-1",
        status: NEWSLETTER_STATUS_PENDING,
        unsubscribedAt: null,
        OR: [
          { updatedAt: { gte: new Date(now.getTime() - NEWSLETTER_VERIFICATION_TTL_MS) } },
          { createdAt: { gte: new Date(now.getTime() - NEWSLETTER_VERIFICATION_TTL_MS) } },
        ],
      },
      data: {
        status: NEWSLETTER_STATUS_VERIFIED,
        verificationToken: null,
        verifiedAt: now,
        unsubscribedAt: null,
      },
    });
    expect(prismaMocks.update).not.toHaveBeenCalled();
    expect(result?.status).toBe(NEWSLETTER_STATUS_VERIFIED);
    expect(result?.verificationToken).toBeNull();
    expect(result?.verifiedAt).toEqual(now);
  });

  test("verify does not overwrite concurrent unsubscribe or rotated token when conditional updateMany matches 0 rows", async () => {
    const now = new Date("2026-06-10T12:00:00.000Z");
    const recent = new Date(now.getTime() - 60_000);
    prismaMocks.findUnique.mockResolvedValueOnce(
      subscriber({ id: "sub-race", verificationToken: "stale-token", createdAt: recent, updatedAt: recent }),
    );
    prismaMocks.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await verify("stale-token", now);

    expect(result).toBeNull();
    expect(prismaMocks.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMocks.update).not.toHaveBeenCalled();
  });

  test("verify falls back cleanly when delegate mock only provides update without updateMany", async () => {
    const originalUpdateMany = (prismaMocks as { updateMany?: typeof prismaMocks.updateMany }).updateMany;
    (prismaMocks as { updateMany?: typeof prismaMocks.updateMany }).updateMany = undefined;

    try {
      const recent = new Date(Date.now() - 60_000);
      prismaMocks.findUnique.mockResolvedValueOnce(subscriber({ createdAt: recent, updatedAt: recent }));
      prismaMocks.update.mockImplementationOnce(async (args) => subscriber({ ...args.data }));

      const result = await verify("token-1");
      expect(result?.status).toBe(NEWSLETTER_STATUS_VERIFIED);
      expect(prismaMocks.update).toHaveBeenCalledTimes(1);
    } finally {
      (prismaMocks as { updateMany?: typeof prismaMocks.updateMany }).updateMany = originalUpdateMany;
    }
  });

  test("rejects verification tokens older than 48 hours with ValidationError without updating DB", async () => {
    const expired = new Date(Date.now() - NEWSLETTER_VERIFICATION_TTL_MS - 1_000);
    prismaMocks.findUnique.mockResolvedValueOnce(
      subscriber({ verificationToken: "expired-token", createdAt: expired, updatedAt: expired }),
    );

    await expect(verify("expired-token")).rejects.toThrow(ValidationError);
    expect(prismaMocks.update).not.toHaveBeenCalled();
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
    prismaMocks.findMany.mockResolvedValueOnce([
      subscriber({ status: NEWSLETTER_STATUS_VERIFIED, verificationToken: null, verifiedAt: new Date() }),
    ]);

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

    expect(prismaMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "sub-25" },
        skip: 1,
        take: 25,
      }),
    );
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

  test("log mailer redacts verification and List-Unsubscribe tokens from diagnostic output", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const mailer = createNewsletterMailer({ provider: "log", fromEmail: "news@example.com", replyTo: "reply@example.com" });

    await expect(
      mailer.sendVerificationEmail({
        email: "reader@example.com",
        verificationToken: "token-1",
        verificationUrl: "https://blog.example/newsletter/verify?token=token-1",
      }),
    ).resolves.toEqual({
      delivered: true,
      provider: "log",
    });

    expect(info).toHaveBeenCalledWith("[newsletter] verification email", {
      email: "reader@example.com",
      fromEmail: "news@example.com",
      replyTo: "reply@example.com",
      verificationUrl: "https://blog.example/newsletter/verify?token=%5Bredacted%5D",
    });

    await expect(
      mailer.sendCampaignEmail?.({
        to: "reader@example.com",
        subject: "Weekly",
        html: "<p>Weekly</p>",
        text: "Weekly",
        headers: {
          "List-Unsubscribe": "<https://blog.example/api/newsletter/unsubscribe?token=secret-unsub-token>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    ).resolves.toEqual({
      delivered: true,
      provider: "log",
      simulated: true,
    });

    expect(JSON.stringify(info.mock.calls)).not.toContain("token-1");
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret-unsub-token");
    info.mockRestore();
  });

  test("maps deprecated NEWSLETTER_PROVIDER=console alias to log with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NEWSLETTER_PROVIDER = "console";

    const mailer = createNewsletterMailer();

    expect(mailer.provider).toBe("log");
    expect(mailer.configured).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEWSLETTER_PROVIDER="console"'));
    warn.mockRestore();
  });
});
