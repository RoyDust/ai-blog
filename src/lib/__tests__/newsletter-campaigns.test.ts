import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  campaignCount: vi.fn(),
  campaignCreate: vi.fn(),
  campaignFindMany: vi.fn(),
  campaignFindUnique: vi.fn(),
  campaignUpdate: vi.fn(),
  campaignUpdateMany: vi.fn(),
  deliveryCount: vi.fn(),
  deliveryFindMany: vi.fn(),
  deliveryUpsert: vi.fn(),
  deliveryUpdate: vi.fn(),
  subscriberCount: vi.fn(),
  subscriberFindMany: vi.fn(),
  subscriberFindUnique: vi.fn(),
  postFindMany: vi.fn(),
}));

const newsletterMocks = vi.hoisted(() => ({
  createNewsletterUnsubscribeToken: vi.fn(),
  listVerifiedSubscribers: vi.fn(),
}));

const mailerMocks = vi.hoisted(() => ({
  createNewsletterMailer: vi.fn(),
  sendCampaignEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
      findMany: prismaMocks.deliveryFindMany,
      upsert: prismaMocks.deliveryUpsert,
      update: prismaMocks.deliveryUpdate,
    },
    newsletterSubscriber: {
      count: prismaMocks.subscriberCount,
      findMany: prismaMocks.subscriberFindMany,
      findUnique: prismaMocks.subscriberFindUnique,
    },
    post: {
      findMany: prismaMocks.postFindMany,
    },
  },
}));

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

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "campaign-1",
    title: "本周精选",
    subject: "本周精选文章",
    intro: "三篇值得读的文章",
    postIds: ["post-1", "post-2"],
    status: "DRAFT",
    scheduledAt: null,
    sentAt: null,
    createdById: "admin-1",
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

function subscriber(overrides: Record<string, unknown> = {}) {
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

describe("newsletter campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    newsletterMocks.createNewsletterUnsubscribeToken.mockImplementation((email: string) => `token-for-${email}`);
    newsletterMocks.listVerifiedSubscribers.mockResolvedValue([]);
    mailerMocks.createNewsletterMailer.mockReturnValue({
      provider: "noop",
      configured: true,
      sendCampaignEmail: mailerMocks.sendCampaignEmail,
    });
    mailerMocks.sendCampaignEmail.mockResolvedValue({ delivered: true });
    prismaMocks.campaignUpdateMany.mockResolvedValue({ count: 1 });
    prismaMocks.deliveryFindMany.mockResolvedValue([]);
    prismaMocks.postFindMany.mockResolvedValue([
      { id: "post-1", title: "文章一", slug: "post-one", excerpt: "摘要一" },
      { id: "post-2", title: "文章二", slug: "post-two", excerpt: null },
    ]);
    prismaMocks.deliveryUpsert.mockImplementation(async (args) => ({
      id: `${args.create.campaignId}-${args.create.subscriberId}`,
      ...args.create,
    }));
  });

  test("creates a draft campaign with selected post ids", async () => {
    prismaMocks.campaignCreate.mockResolvedValueOnce(campaign());

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
  });

  test("sends only verified subscribers and marks a successful campaign sent", async () => {
    const subscribers = [subscriber(), subscriber({ id: "sub-2", email: "second@example.com" })];
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce(subscribers);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    const sent = await sendNewsletterCampaign("campaign-1");

    expect(newsletterMocks.listVerifiedSubscribers).toHaveBeenCalledWith(500);
    expect(newsletterMocks.listVerifiedSubscribers).toHaveBeenCalledWith(500, "sub-2");
    expect(prismaMocks.campaignUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "campaign-1" }),
      data: { status: "SENDING" },
    }));
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(2);
    expect(prismaMocks.deliveryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ campaignId: "campaign-1", subscriberId: "sub-1", status: "sent" }),
    }));
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: expect.objectContaining({ status: "SENT", sentAt: expect.any(Date) }),
    }));
    expect(sent.status).toBe("SENT");
  });

  test("continues sending all subscriber pages beyond the first batch", async () => {
    const firstBatch = Array.from({ length: 500 }, (_, index) =>
      subscriber({ id: `sub-${index + 1}`, email: `reader-${index + 1}@example.com` }),
    );
    const secondBatch = [subscriber({ id: "sub-501", email: "reader-501@example.com" })];
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    newsletterMocks.listVerifiedSubscribers
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce(secondBatch)
      .mockResolvedValueOnce([]);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    await sendNewsletterCampaign("campaign-1");

    expect(newsletterMocks.listVerifiedSubscribers).toHaveBeenNthCalledWith(1, 500);
    expect(newsletterMocks.listVerifiedSubscribers).toHaveBeenNthCalledWith(2, 500, "sub-500");
    expect(newsletterMocks.listVerifiedSubscribers).toHaveBeenNthCalledWith(3, 500, "sub-501");
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(501);
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: expect.objectContaining({ status: "SENT" }),
    }));
  });

  test("does not overwrite a campaign recovered while sending finishes", async () => {
    const subscribers = [subscriber()];
    prismaMocks.campaignFindUnique
      .mockResolvedValueOnce(campaign())
      .mockResolvedValueOnce(campaign({ status: "PARTIAL_FAILED" }));
    prismaMocks.campaignUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce(subscribers).mockResolvedValueOnce([]);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    const sent = await sendNewsletterCampaign("campaign-1");

    expect(prismaMocks.campaignUpdateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: expect.objectContaining({ status: "SENT" }),
    }));
    expect(prismaMocks.campaignUpdate).not.toHaveBeenCalled();
    expect(sent.status).toBe("PARTIAL_FAILED");
  });

  test("skips subscribers that already have sent deliveries when resending a partial campaign", async () => {
    const subscribers = [subscriber(), subscriber({ id: "sub-2", email: "second@example.com" })];
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "PARTIAL_FAILED" }));
    prismaMocks.deliveryFindMany
      .mockResolvedValueOnce([{ subscriberId: "sub-1", status: "sent" }])
      .mockResolvedValueOnce([]);
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce(subscribers).mockResolvedValueOnce([]);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    await sendNewsletterCampaign("campaign-1");

    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "second@example.com" }));
    expect(prismaMocks.deliveryUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ subscriberId: "sub-1" }),
    }));
  });

  test("marks a campaign partial failed when a recipient send fails", async () => {
    mailerMocks.sendCampaignEmail
      .mockResolvedValueOnce({ delivered: true })
      .mockRejectedValueOnce(new Error("smtp failed"));
    const subscribers = [subscriber(), subscriber({ id: "sub-2", email: "second@example.com" })];
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce(subscribers);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    await sendNewsletterCampaign("campaign-1");

    expect(prismaMocks.deliveryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        subscriberId: "sub-2",
        status: "failed",
        error: "smtp failed",
      }),
    }));
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: expect.objectContaining({ status: "PARTIAL_FAILED" }),
    }));
  });

  test("records noop provider results as failed deliveries", async () => {
    mailerMocks.sendCampaignEmail.mockResolvedValueOnce({ delivered: false, reason: "provider_not_configured" });
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce([subscriber()]);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");
    const sent = await sendNewsletterCampaign("campaign-1");

    expect(prismaMocks.deliveryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        subscriberId: "sub-1",
        status: "failed",
        error: "provider_not_configured",
      }),
    }));
    expect(sent.status).toBe("PARTIAL_FAILED");
  });

  test("does not send when another request already claimed the campaign", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    prismaMocks.campaignUpdateMany.mockResolvedValueOnce({ count: 0 });

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");

    await expect(sendNewsletterCampaign("campaign-1")).rejects.toThrow("Campaign is already being sent");
    expect(newsletterMocks.listVerifiedSubscribers).not.toHaveBeenCalled();
    expect(mailerMocks.sendCampaignEmail).not.toHaveBeenCalled();
  });

  test("does not reclaim campaigns that are already sending", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "SENDING" }));

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");

    await expect(sendNewsletterCampaign("campaign-1")).rejects.toThrow("Campaign cannot be sent in current status");
    expect(prismaMocks.campaignUpdateMany).not.toHaveBeenCalled();
    expect(mailerMocks.sendCampaignEmail).not.toHaveBeenCalled();
  });

  test("rolls a claimed campaign back to partial failed when sending throws", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign());
    prismaMocks.postFindMany.mockRejectedValueOnce(new Error("database unavailable"));
    newsletterMocks.listVerifiedSubscribers.mockResolvedValueOnce([subscriber()]);

    const { sendNewsletterCampaign } = await import("../newsletter-campaigns");

    await expect(sendNewsletterCampaign("campaign-1")).rejects.toThrow("database unavailable");
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith({
      where: { id: "campaign-1", status: "SENDING" },
      data: { status: "PARTIAL_FAILED" },
    });
  });

  test("retries failed deliveries for subscribers that are still verified", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "PARTIAL_FAILED" }));
    prismaMocks.deliveryFindMany.mockResolvedValueOnce([
      { id: "delivery-1", campaignId: "campaign-1", subscriberId: "sub-1", email: "reader@example.com", status: "failed" },
      { id: "delivery-2", campaignId: "campaign-1", subscriberId: "sub-2", email: "gone@example.com", status: "failed" },
    ]);
    prismaMocks.subscriberFindMany.mockResolvedValueOnce([subscriber()]);
    prismaMocks.deliveryCount.mockResolvedValueOnce(0);

    const { retryNewsletterCampaignFailures } = await import("../newsletter-campaigns");
    const retried = await retryNewsletterCampaignFailures("campaign-1");

    expect(mailerMocks.sendCampaignEmail).toHaveBeenCalledTimes(1);
    expect(prismaMocks.subscriberFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["sub-1", "sub-2"] },
        status: "verified",
        unsubscribedAt: null,
      },
      select: { id: true, email: true },
    });
    expect(prismaMocks.subscriberFindUnique).not.toHaveBeenCalled();
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: expect.objectContaining({ status: "SENT" }),
    }));
    expect(retried.status).toBe("SENT");
  });

  test("keeps failed campaigns failed when there are no failed deliveries to retry", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "FAILED" }));
    prismaMocks.deliveryFindMany.mockResolvedValueOnce([]);
    prismaMocks.campaignUpdateMany.mockResolvedValue({ count: 1 });

    const { retryNewsletterCampaignFailures } = await import("../newsletter-campaigns");
    const retried = await retryNewsletterCampaignFailures("campaign-1");

    expect(mailerMocks.sendCampaignEmail).not.toHaveBeenCalled();
    expect(prismaMocks.deliveryCount).not.toHaveBeenCalled();
    expect(prismaMocks.campaignUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "campaign-1", status: "SENDING" },
      data: { status: "FAILED", sentAt: null },
    }));
    expect(retried.status).toBe("FAILED");
  });

  test("recovers a stuck sending campaign to draft when no deliveries exist", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "SENDING" }));
    prismaMocks.deliveryCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prismaMocks.campaignUpdate.mockImplementationOnce(async (args) => campaign(args.data));

    const { recoverSendingNewsletterCampaign } = await import("../newsletter-campaigns");
    const recovered = await recoverSendingNewsletterCampaign("campaign-1");

    expect(prismaMocks.campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "DRAFT", sentAt: null },
    }));
    expect(recovered.status).toBe("DRAFT");
  });

  test("recovers a stuck sending campaign to partial failed when deliveries exist", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "SENDING" }));
    prismaMocks.deliveryCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    prismaMocks.campaignUpdate.mockImplementationOnce(async (args) => campaign(args.data));

    const { recoverSendingNewsletterCampaign } = await import("../newsletter-campaigns");
    const recovered = await recoverSendingNewsletterCampaign("campaign-1");

    expect(prismaMocks.campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIAL_FAILED", sentAt: expect.any(Date) }),
    }));
    expect(recovered.status).toBe("PARTIAL_FAILED");
  });

  test("rejects recovery for campaigns that are not sending", async () => {
    prismaMocks.campaignFindUnique.mockResolvedValueOnce(campaign({ status: "DRAFT" }));

    const { recoverSendingNewsletterCampaign } = await import("../newsletter-campaigns");

    await expect(recoverSendingNewsletterCampaign("campaign-1")).rejects.toThrow("Only sending campaigns can be recovered");
    expect(prismaMocks.deliveryCount).not.toHaveBeenCalled();
    expect(prismaMocks.campaignUpdate).not.toHaveBeenCalled();
  });

  test("lists subscribers with status stats", async () => {
    prismaMocks.subscriberCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMocks.subscriberFindMany.mockResolvedValueOnce([subscriber()]);

    const { listNewsletterSubscribers } = await import("../newsletter-campaigns");
    const result = await listNewsletterSubscribers({ status: "verified", page: 1, limit: 10 });

    expect(prismaMocks.subscriberFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: "verified", unsubscribedAt: null },
      take: 10,
    }));
    expect(result.stats).toEqual({ total: 4, pending: 1, verified: 2, unsubscribed: 1 });
  });
});
