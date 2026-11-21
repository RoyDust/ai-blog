import { beforeEach, describe, expect, test, vi } from "vitest";

import { ValidationError } from "@/lib/api-errors";

type MockCampaign = {
  id: string;
  title: string;
  subject: string;
  intro: string | null;
  postIds: string[];
  status: "DRAFT" | "SENDING" | "SENT" | "PARTIAL_FAILED" | "FAILED";
  scheduledAt: Date | null;
  sentAt: Date | null;
  audienceFrozenAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockDelivery = {
  id: string;
  campaignId: string;
  subscriberId: string;
  email: string;
  status: string;
  error: string | null;
  sentAt: Date | null;
  attemptId: string | null;
  attemptStartedAt: Date | null;
  provider: string | null;
  providerReceiptId: string | null;
  evidenceReference: string | null;
  simulated: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockSubscriber = {
  id: string;
  email: string;
  status: string;
  verifiedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const state = vi.hoisted(() => ({
  campaigns: new Map<string, MockCampaign>(),
  deliveries: new Map<string, MockDelivery>(),
  subscribers: new Map<string, MockSubscriber>(),
  failPersistSentForDeliveryId: null as string | null,
}));

const prismaMocks = vi.hoisted(() => ({
  campaignCount: vi.fn(),
  campaignCreate: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignUpdate: vi.fn(),
  campaignUpdateMany: vi.fn(),
  deliveryCount: vi.fn(),
  deliveryFindFirst: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  subscriberCount: vi.fn(),
  subscriberFindMany: vi.fn(),
  subscriberFindUnique: vi.fn(),
  postFindMany: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
}));

const newsletterMocks = vi.hoisted(() => ({
  createNewsletterUnsubscribeToken: vi.fn(),
  listVerifiedSubscribers: vi.fn(),
}));

const mailerMocks = vi.hoisted(() => ({
  createNewsletterMailer: vi.fn(),
  sendCampaignEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    $queryRaw: prismaMocks.queryRaw,
    $executeRaw: prismaMocks.executeRaw,
    $transaction: prismaMocks.transaction,
    newsletterCampaign: {
      count: prismaMocks.campaignCount,
      create: prismaMocks.campaignCreate,
      findMany: prismaMocks.campaignFindMany,
      findUnique: prismaMocks.campaignFindUnique,
      update: prismaMocks.campaignUpdate,
      updateMany: prismaMocks.campaignUpdateMany,
    },
    newsletterDelivery: {
      count: prismaMocks.deliveryCount,
      findFirst: prismaMocks.deliveryFindFirst,
      findMany: prismaMocks.deliveryFindMany,
      update: prismaMocks.deliveryUpdate,
      updateMany: prismaMocks.deliveryUpdateMany,
    },
    newsletterSubscriber: {
      count: prismaMocks.subscriberCount,
      findMany: prismaMocks.subscriberFindMany,
      findUnique: prismaMocks.subscriberFindUnique,
    },
    post: {
      findMany: prismaMocks.postFindMany,
    },
  };
  prismaMocks.transaction.mockImplementation(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client));
  return { prisma: client };
});

vi.mock("@/lib/newsletter", () => ({
  createNewsletterUnsubscribeToken: newsletterMocks.createNewsletterUnsubscribeToken,
  listVerifiedSubscribers: newsletterMocks.listVerifiedSubscribers,
}));

vi.mock("@/lib/newsletter-mailer", () => ({
  createNewsletterMailer: mailerMocks.createNewsletterMailer,
}));

vi.mock("@/lib/seo", () => ({
  getSiteUrl: () => "https://blog.example",
}));

function makeCampaign(overrides: Partial<MockCampaign> = {}): MockCampaign {
  return {
    id: "campaign-1",
    title: "本周精选",
    subject: "本周精选文章",
    intro: "三篇值得读的文章",
    postIds: ["post-1", "post-2"],
    status: "DRAFT",
    scheduledAt: null,
    sentAt: null,
    audienceFrozenAt: null,
    createdById: "admin-1",
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

function makeSubscriber(overrides: Partial<MockSubscriber> = {}): MockSubscriber {
  return {
    id: "sub-1",
    email: "reader@example.com",
    status: "verified",
    verifiedAt: new Date("2026-06-07T00:00:00.000Z"),
    unsubscribedAt: null,
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

function wireStatefulPrisma() {
  prismaMocks.queryRaw.mockResolvedValue([{ id: "locked" }]);
  prismaMocks.executeRaw.mockImplementation(async (_strings: TemplateStringsArray, campaignId: string) => {
    let index = 0;
    for (const sub of state.subscribers.values()) {
      if (sub.status === "verified" && sub.verifiedAt && !sub.unsubscribedAt) {
        index += 1;
        const id = `del-${index}`;
        state.deliveries.set(id, {
          id,
          campaignId,
          subscriberId: sub.id,
          email: sub.email,
          status: "pending",
          error: null,
          sentAt: null,
          attemptId: null,
          attemptStartedAt: null,
          provider: null,
          providerReceiptId: null,
          evidenceReference: null,
          simulated: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
    return index;
  });

  prismaMocks.campaignFindUnique.mockImplementation(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
    const found = state.campaigns.get(where.id);
    if (!found) return null;
    if (include) {
      return {
        ...found,
        deliveries: [...state.deliveries.values()].filter((d) => d.campaignId === where.id),
      };
    }
    return { ...found };
  });

  prismaMocks.campaignUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<MockCampaign> }) => {
    const existing = state.campaigns.get(where.id);
    if (!existing) throw new Error("Campaign missing");
    const next = { ...existing, ...data, updatedAt: new Date() };
    state.campaigns.set(where.id, next);
    return { ...next };
  });

  prismaMocks.deliveryCount.mockImplementation(async ({ where }: { where: { campaignId: string } }) => {
    return [...state.deliveries.values()].filter((d) => d.campaignId === where.campaignId).length;
  });

  prismaMocks.deliveryFindMany.mockImplementation(async ({ where }: { where: { campaignId: string; status?: string } }) => {
    return [...state.deliveries.values()]
      .filter((d) => d.campaignId === where.campaignId && (!where.status || d.status === where.status))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((d) => ({ ...d }));
  });

  prismaMocks.deliveryFindFirst.mockImplementation(async ({ where }: { where: { id: string; campaignId: string } }) => {
    const found = state.deliveries.get(where.id);
    return found && found.campaignId === where.campaignId ? { ...found } : null;
  });

  prismaMocks.deliveryUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: Partial<MockDelivery> }) => {
    const existing = state.deliveries.get(where.id);
    if (!existing) throw new Error("Delivery missing");
    const next = { ...existing, ...data, updatedAt: new Date() };
    state.deliveries.set(where.id, next);
    return { ...next };
  });

  prismaMocks.deliveryUpdateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id?: string; campaignId?: string; status?: string; attemptId?: string | null };
      data: Partial<MockDelivery>;
    }) => {
      if (where.id && where.id === state.failPersistSentForDeliveryId) {
        throw new Error("Simulated process crash before persisting outcome");
      }
      let count = 0;
      for (const [id, row] of state.deliveries.entries()) {
        const matchesId = !where.id || row.id === where.id;
        const matchesCampaign = !where.campaignId || row.campaignId === where.campaignId;
        const matchesStatus = !where.status || row.status === where.status;
        const matchesAttempt = where.attemptId === undefined || row.attemptId === where.attemptId;
        if (matchesId && matchesCampaign && matchesStatus && matchesAttempt) {
          state.deliveries.set(id, { ...row, ...data, updatedAt: new Date() });
          count += 1;
        }
      }
      return { count };
    },
  );

  prismaMocks.subscriberFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    return state.subscribers.get(where.id) ?? null;
  });
}

describe("newsletter campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.campaigns.clear();
    state.deliveries.clear();
    state.subscribers.clear();
    state.failPersistSentForDeliveryId = null;

    newsletterMocks.createNewsletterUnsubscribeToken.mockImplementation((email: string) => `token-for-${email}`);
    newsletterMocks.listVerifiedSubscribers.mockResolvedValue([]);
    mailerMocks.createNewsletterMailer.mockReturnValue({
      provider: "log",
      configured: true,
      simulated: true,
      sendCampaignEmail: mailerMocks.sendCampaignEmail,
    });
    mailerMocks.sendCampaignEmail.mockResolvedValue({ delivered: true, provider: "log", simulated: true });
    prismaMocks.campaignUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.deliveryFindMany.mockResolvedValue([]);
    prismaMocks.postFindMany.mockResolvedValue([
      { id: "post-1", title: "文章一", slug: "post-one", excerpt: "摘要一" },
      { id: "post-2", title: "文章二", slug: "post-two", excerpt: null },
    ]);
  });

  test("creates a draft campaign with selected post ids and rejects unconsumed scheduledAt", async () => {
    prismaMocks.campaignCreate.mockResolvedValueOnce(makeCampaign());

    const { createNewsletterCampaign } = await import("../newsletter-campaigns");
    const created = await createNewsletterCampaign({
      title: "本周精选",
      subject: "本周精选文章",
      intro: "三篇值得读的文章",
      postIds: ["post-1", "post-1", "post-2"],
      createdById: "admin-1",
    });

    expect(prismaMocks.campaignCreate).toHaveBeenCalledWith({
      data: {
        title: "本周精选",
        subject: "本周精选文章",
        intro: "三篇值得读的文章",
        postIds: ["post-1", "post-2"],
        createdById: "admin-1",
      },
    });
    expect(created.status).toBe("DRAFT");

    await expect(
      createNewsletterCampaign({
        title: "定时活动",
        subject: "定时主题",
        scheduledAt: "2026-12-01T08:00:00.000Z",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("lists campaigns with mailer simulation status", async () => {
    prismaMocks.campaignCount.mockResolvedValueOnce(1);
    prismaMocks.campaignFindMany.mockResolvedValueOnce([{ ...makeCampaign(), deliveries: [] }]);

    const { listNewsletterCampaigns } = await import("../newsletter-campaigns");
    const result = await listNewsletterCampaigns({ page: 1, limit: 10 });

    expect(result.mailer).toEqual({
      enabled: false,
      provider: "log",
      configured: true,
      simulated: true,
      fromEmail: null,
    });
  });

  test("lists subscribers with status stats", async () => {
    prismaMocks.subscriberCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMocks.subscriberFindMany.mockResolvedValueOnce([makeSubscriber()]);

    const { listNewsletterSubscribers } = await import("../newsletter-campaigns");
    const result = await listNewsletterSubscribers({ status: "verified", page: 1, limit: 10 });

    expect(prismaMocks.subscriberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "verified", unsubscribedAt: null },
        take: 10,
      }),
    );
    expect(result.stats).toEqual({ total: 4, pending: 1, verified: 2, unsubscribed: 1 });
  });

  test("detaches background send after freezing SENDING state, emits List-Unsubscribe headers, and preserves P2-03 crash recovery contract", async () => {
    wireStatefulPrisma();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    state.campaigns.set("campaign-async", makeCampaign({ id: "campaign-async" }));
    state.subscribers.set("sub-1", makeSubscriber({ id: "sub-1", email: "one@example.com" }));
    state.subscribers.set("sub-2", makeSubscriber({ id: "sub-2", email: "two@example.com" }));
    state.subscribers.set("sub-3", makeSubscriber({ id: "sub-3", email: "three@example.com" }));
    state.subscribers.set("sub-4", makeSubscriber({ id: "sub-4", email: "four@example.com" }));

    // Recipient 1 -> accepted (sent)
    // Recipient 2 -> explicitly rejected (failed)
    // Recipient 3 -> accepted upstream, then local crash before persistOutcome (stays sending!)
    // Recipient 4 -> never reached before crash (stays pending!)
    state.failPersistSentForDeliveryId = "del-3";
    mailerMocks.sendCampaignEmail
      .mockResolvedValueOnce({ delivered: true, provider: "log", simulated: true })
      .mockResolvedValueOnce({ delivered: false, provider: "noop", reason: "mailbox_rejected" })
      .mockResolvedValueOnce({ delivered: true, provider: "log", simulated: true });

    const {
      getNewsletterCampaign,
      recoverSendingNewsletterCampaign,
      retryNewsletterCampaignFailures,
      sendNewsletterCampaign,
    } = await import("../newsletter-campaigns");

    let backgroundTask!: Promise<unknown>;
    const accepted = await sendNewsletterCampaign("campaign-async", {
      background: true,
      onBackgroundComplete: (promise) => {
        backgroundTask = promise;
      },
    });

    // Immediate 202 payload: SENDING persisted, audience frozen, background loop not yet executed
    expect(accepted.status).toBe("SENDING");
    expect(accepted.audienceFrozenAt).toBeInstanceOf(Date);
    expect(accepted.deliveryStats).toMatchObject({ total: 4, pending: 4, sent: 0 });
    expect(mailerMocks.sendCampaignEmail).not.toHaveBeenCalled();

    // Wait for background crash on recipient 3
    await expect(backgroundTask).rejects.toThrow("Simulated process crash");

    // Verify RFC 8058 One-Click headers were emitted on every outbound email
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(3);
    expect(mailerMocks.sendCampaignEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "one@example.com",
        headers: {
          "List-Unsubscribe": "<https://blog.example/api/newsletter/unsubscribe?token=token-for-one%40example.com>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    );

    // Campaign stays SENDING after mid-flight interruption; admin locates it by campaignId
    const midCrash = await getNewsletterCampaign("campaign-async");
    expect(midCrash.status).toBe("SENDING");
    expect(midCrash.deliveryStats).toEqual({
      total: 4,
      sent: 1,
      failed: 1,
      sending: 1,
      pending: 1,
      skipped: 0,
      unknown: 0,
    });

    // Recovery requires explicit senderStopped confirmation and converts in-flight `sending` -> `unknown`
    state.failPersistSentForDeliveryId = null;
    await expect(recoverSendingNewsletterCampaign("campaign-async")).rejects.toThrow("确认");
    const recovered = await recoverSendingNewsletterCampaign("campaign-async", { senderStopped: true });
    expect(recovered.status).toBe("PARTIAL_FAILED");
    expect(recovered.deliveryStats).toEqual({
      total: 4,
      sent: 1,
      failed: 1,
      sending: 0,
      pending: 1,
      skipped: 0,
      unknown: 1,
    });

    // Resume (`send`) ONLY consumes `pending` (four@example.com); NEVER resends `sent`, `failed`, or `unknown`
    mailerMocks.sendCampaignEmail.mockClear();
    mailerMocks.sendCampaignEmail.mockResolvedValueOnce({ delivered: true, provider: "log", simulated: true });
    const afterResume = await sendNewsletterCampaign("campaign-async");
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "four@example.com" }));
    expect(afterResume.deliveryStats).toEqual({
      total: 4,
      sent: 2,
      failed: 1,
      sending: 0,
      pending: 0,
      skipped: 0,
      unknown: 1,
    });

    // `retry` ONLY consumes `failed` (two@example.com); NEVER resends `sent` or `unknown`
    mailerMocks.sendCampaignEmail.mockClear();
    mailerMocks.sendCampaignEmail.mockResolvedValueOnce({ delivered: true, provider: "log", simulated: true });
    let retryBackground!: Promise<unknown>;
    const retryAccepted = await retryNewsletterCampaignFailures("campaign-async", {
      background: true,
      onBackgroundComplete: (promise) => {
        retryBackground = promise;
      },
    });
    expect(retryAccepted.status).toBe("SENDING");
    await retryBackground;

    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "two@example.com" }));

    const finalState = await getNewsletterCampaign("campaign-async");
    expect(finalState.status).toBe("PARTIAL_FAILED");
    expect(finalState.deliveryStats).toEqual({
      total: 4,
      sent: 3,
      failed: 0,
      sending: 0,
      pending: 0,
      skipped: 0,
      unknown: 1,
    });

    errorSpy.mockRestore();
  });
});
