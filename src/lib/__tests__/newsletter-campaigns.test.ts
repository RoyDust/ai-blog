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

  // Delivery lifecycle, crash recovery and concurrency are covered against PostgreSQL
  // in tests/integration/newsletter-recovery.test.ts.

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
