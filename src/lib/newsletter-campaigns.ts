import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { createNewsletterMailer } from "@/lib/newsletter-mailer";
import { createNewsletterUnsubscribeToken, listVerifiedSubscribers } from "@/lib/newsletter";
import { prisma } from "@/lib/prisma";
import { renderNewsletterEmail } from "@/lib/newsletter-renderer";
import { getSiteUrl } from "@/lib/seo";

type NewsletterCampaignStatus = "DRAFT" | "SENDING" | "SENT" | "PARTIAL_FAILED" | "FAILED";
type DeliveryStatus = "pending" | "sent" | "failed";

type CampaignRecord = {
  id: string;
  title: string;
  subject: string;
  intro: string | null;
  postIds: string[];
  status: NewsletterCampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriberRecord = {
  id: string;
  email: string;
  status: string;
  verifiedAt: Date | null;
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeliveryRecord = {
  id: string;
  campaignId: string;
  subscriberId: string;
  email: string;
  status: string;
  error: string | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DeliveryStats = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

type NewsletterPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
};

type CreateCampaignInput = {
  title: unknown;
  subject: unknown;
  intro?: unknown;
  postIds?: unknown;
  createdById?: string | null;
  scheduledAt?: unknown;
};

type UpdateCampaignInput = Partial<CreateCampaignInput>;

type ListCampaignsOptions = {
  page?: string | number | null;
  limit?: string | number | null;
  status?: string | null;
  q?: string | null;
};

type ListSubscribersOptions = {
  page?: string | number | null;
  limit?: string | number | null;
  status?: string | null;
  q?: string | null;
};

type PrismaNewsletterClient = typeof prisma & {
  newsletterCampaign: {
    count(args: unknown): Promise<number>;
    create(args: unknown): Promise<CampaignRecord>;
    findMany(args: unknown): Promise<CampaignRecord[]>;
    findUnique(args: unknown): Promise<(CampaignRecord & { deliveries?: DeliveryRecord[] }) | null>;
    update(args: unknown): Promise<CampaignRecord>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  newsletterDelivery: {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<DeliveryRecord[]>;
    upsert(args: unknown): Promise<DeliveryRecord>;
    update(args: unknown): Promise<DeliveryRecord>;
  };
  newsletterSubscriber: {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<SubscriberRecord[]>;
    findUnique(args: unknown): Promise<SubscriberRecord | null>;
  };
  post: {
    findMany(args: unknown): Promise<NewsletterPost[]>;
  };
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SEND_BATCH_SIZE = 500;
const allowedCampaignStatuses = new Set<NewsletterCampaignStatus>([
  "DRAFT",
  "SENDING",
  "SENT",
  "PARTIAL_FAILED",
  "FAILED",
]);
const allowedSubscriberStatuses = new Set(["pending", "verified", "unsubscribed"]);

function newsletterClient() {
  return prisma as PrismaNewsletterClient;
}

function normalizeText(value: unknown, field: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new ValidationError(`${field} is required`);
  }

  return text;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePostIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)));
}

function normalizeDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Scheduled time is invalid");
  }

  return date;
}

function normalizePositiveInteger(value: unknown, fallback: number, max = MAX_PAGE_SIZE) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function buildPagination(pageInput: unknown, limitInput: unknown, total: number) {
  const limit = normalizePositiveInteger(limitInput, DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const requestedPage = normalizePositiveInteger(pageInput, 1, Number.MAX_SAFE_INTEGER);
  const page = Math.min(requestedPage, totalPages);

  return { page, limit, total, totalPages };
}

function normalizeCampaignStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase();
  if (!normalized || normalized === "ALL") {
    return null;
  }

  if (!allowedCampaignStatuses.has(normalized as NewsletterCampaignStatus)) {
    throw new ValidationError("Invalid campaign status");
  }

  return normalized as NewsletterCampaignStatus;
}

function normalizeSubscriberStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  if (!normalized || normalized === "all") {
    return null;
  }

  if (!allowedSubscriberStatuses.has(normalized)) {
    throw new ValidationError("Invalid subscriber status");
  }

  return normalized;
}

function buildCampaignWhere(options: ListCampaignsOptions) {
  const status = normalizeCampaignStatus(options.status);
  const query = typeof options.q === "string" ? options.q.trim() : "";

  return {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { subject: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function buildSubscriberWhere(options: ListSubscribersOptions) {
  const status = normalizeSubscriberStatus(options.status);
  const query = typeof options.q === "string" ? options.q.trim() : "";

  return {
    ...(status ? { status } : {}),
    ...(status === "verified" ? { unsubscribedAt: null } : {}),
    ...(query ? { email: { contains: query, mode: "insensitive" } } : {}),
  };
}

function buildDeliveryStats(deliveries: Array<Pick<DeliveryRecord, "status">>): DeliveryStats {
  const sent = deliveries.filter((delivery) => delivery.status === "sent").length;
  const failed = deliveries.filter((delivery) => delivery.status === "failed").length;
  const pending = deliveries.filter((delivery) => delivery.status === "pending").length;

  return {
    total: deliveries.length,
    sent,
    failed,
    pending,
  };
}

function toPublicCampaign(campaign: CampaignRecord & { deliveries?: Array<Pick<DeliveryRecord, "status">>; deliveryStats?: DeliveryStats }) {
  const deliveryStats = campaign.deliveryStats ?? buildDeliveryStats(campaign.deliveries ?? []);

  return {
    ...campaign,
    deliveryStats,
  };
}

async function loadCampaign(campaignId: string, includeDeliveries = false) {
  const id = normalizeText(campaignId, "Campaign ID");
  const campaign = await newsletterClient().newsletterCampaign.findUnique({
    where: { id },
    ...(includeDeliveries
      ? {
          include: {
            deliveries: {
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            },
          },
        }
      : {}),
  });

  if (!campaign) {
    throw new NotFoundError("Campaign not found");
  }

  return campaign;
}

async function loadCampaignPosts(postIds: string[]) {
  if (postIds.length === 0) {
    return [];
  }

  const posts = await newsletterClient().post.findMany({
    where: {
      id: { in: postIds },
      deletedAt: null,
      published: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
    },
  });
  const position = new Map(postIds.map((id, index) => [id, index]));

  return [...posts].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

function deliveryErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function upsertDelivery(
  campaignId: string,
  subscriber: Pick<SubscriberRecord, "id" | "email">,
  status: DeliveryStatus,
  error: string | null,
) {
  const now = new Date();

  return newsletterClient().newsletterDelivery.upsert({
    where: {
      campaignId_subscriberId: {
        campaignId,
        subscriberId: subscriber.id,
      },
    },
    create: {
      campaignId,
      subscriberId: subscriber.id,
      email: subscriber.email,
      status,
      error,
      sentAt: status === "sent" ? now : null,
    },
    update: {
      email: subscriber.email,
      status,
      error,
      sentAt: status === "sent" ? now : null,
    },
  });
}

async function listSentDeliverySubscriberIds(campaignId: string, subscriberIds: string[]) {
  if (subscriberIds.length === 0) {
    return new Set<string>();
  }

  const deliveries = await newsletterClient().newsletterDelivery.findMany({
    where: {
      campaignId,
      subscriberId: { in: subscriberIds },
      status: "sent",
    },
    select: { subscriberId: true },
  });

  return new Set(deliveries.map((delivery) => delivery.subscriberId));
}

async function sendCampaignToSubscribers(campaign: CampaignRecord, subscribers: Array<Pick<SubscriberRecord, "id" | "email">>) {
  const posts = await loadCampaignPosts(campaign.postIds);
  const siteUrl = getSiteUrl();
  const alreadySentSubscriberIds = await listSentDeliverySubscriberIds(campaign.id, subscribers.map((subscriber) => subscriber.id));
  let failedCount = 0;

  for (const subscriber of subscribers) {
    if (alreadySentSubscriberIds.has(subscriber.id)) {
      continue;
    }

    try {
      const unsubscribeToken = createNewsletterUnsubscribeToken(subscriber.email);
      const email = renderNewsletterEmail({
        subject: campaign.subject,
        intro: campaign.intro,
        posts,
        siteUrl,
        unsubscribeToken,
      });

      const result = await sendNewsletterEmail({ to: subscriber.email, subject: email.subject, html: email.html, text: email.text });
      if (isUndeliveredMailResult(result)) {
        throw new Error(result.reason ?? "Newsletter provider did not deliver the message");
      }
      await upsertDelivery(campaign.id, subscriber, "sent", null);
    } catch (error) {
      failedCount += 1;
      await upsertDelivery(campaign.id, subscriber, "failed", deliveryErrorMessage(error));
    }
  }

  return { failedCount };
}

export type NewsletterOutboundMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendNewsletterEmail(message: NewsletterOutboundMessage) {
  const mailer = createNewsletterMailer() as ReturnType<typeof createNewsletterMailer> & {
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

    return { delivered: true, provider: "log" as const };
  }

  return { delivered: false, provider: "noop" as const, reason: "provider_not_configured" as const };
}

function isUndeliveredMailResult(result: unknown): result is { delivered: false; reason?: string } {
  return typeof result === "object" && result !== null && "delivered" in result && result.delivered === false;
}

async function claimCampaignForSending(campaign: CampaignRecord) {
  if (campaign.status !== "DRAFT" && campaign.status !== "PARTIAL_FAILED") {
    throw new ValidationError("Campaign cannot be sent in current status");
  }

  const result = await newsletterClient().newsletterCampaign.updateMany({
    where: {
      id: campaign.id,
      status: { in: ["DRAFT", "PARTIAL_FAILED"] },
    },
    data: { status: "SENDING" },
  });

  if (result.count !== 1) {
    throw new ValidationError("Campaign is already being sent");
  }
}

async function markCampaignSendInterrupted(campaignId: string) {
  try {
    await newsletterClient().newsletterCampaign.updateMany({
      where: { id: campaignId, status: "SENDING" },
      data: { status: "PARTIAL_FAILED" },
    });
  } catch {
    // Preserve the original send failure; manual recovery can still fix SENDING.
  }
}

async function finishSendingCampaign(campaign: CampaignRecord, nextStatus: NewsletterCampaignStatus) {
  const sentAt = nextStatus === "SENT" || nextStatus === "PARTIAL_FAILED" ? new Date() : null;
  const result = await newsletterClient().newsletterCampaign.updateMany({
    where: { id: campaign.id, status: "SENDING" },
    data: {
      status: nextStatus,
      sentAt,
    },
  });

  if (result.count === 1) {
    return {
      ...campaign,
      status: nextStatus,
      sentAt,
    };
  }

  return loadCampaign(campaign.id);
}

export async function createNewsletterCampaign(input: CreateCampaignInput) {
  return newsletterClient().newsletterCampaign.create({
    data: {
      title: normalizeText(input.title, "Title"),
      subject: normalizeText(input.subject, "Subject"),
      intro: normalizeOptionalText(input.intro),
      postIds: normalizePostIds(input.postIds),
      createdById: input.createdById ?? null,
      ...(input.scheduledAt !== undefined ? { scheduledAt: normalizeDate(input.scheduledAt) } : {}),
    },
  });
}

export async function updateNewsletterCampaign(campaignId: string, input: UpdateCampaignInput) {
  const campaign = await loadCampaign(campaignId);

  if (campaign.status !== "DRAFT") {
    throw new ValidationError("Only draft campaigns can be updated");
  }

  return newsletterClient().newsletterCampaign.update({
    where: { id: campaign.id },
    data: {
      ...(input.title !== undefined ? { title: normalizeText(input.title, "Title") } : {}),
      ...(input.subject !== undefined ? { subject: normalizeText(input.subject, "Subject") } : {}),
      ...(input.intro !== undefined ? { intro: normalizeOptionalText(input.intro) } : {}),
      ...(input.postIds !== undefined ? { postIds: normalizePostIds(input.postIds) } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: normalizeDate(input.scheduledAt) } : {}),
    },
  });
}

export async function listNewsletterCampaigns(options: ListCampaignsOptions = {}) {
  const where = buildCampaignWhere(options);
  const total = await newsletterClient().newsletterCampaign.count({ where });
  const pagination = buildPagination(options.page, options.limit, total);
  const campaigns = await newsletterClient().newsletterCampaign.findMany({
    where,
    include: { deliveries: { select: { status: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  });

  return {
    data: campaigns.map(toPublicCampaign),
    pagination,
  };
}

export async function getNewsletterCampaign(campaignId: string) {
  const campaign = await loadCampaign(campaignId, true);
  const posts = await loadCampaignPosts(campaign.postIds);

  return {
    ...toPublicCampaign(campaign),
    posts,
  };
}

export async function previewNewsletterCampaign(input: {
  subject: unknown;
  intro?: unknown;
  postIds?: unknown;
  unsubscribeToken?: unknown;
}) {
  const subject = normalizeText(input.subject, "Subject");
  const posts = await loadCampaignPosts(normalizePostIds(input.postIds));

  return renderNewsletterEmail({
    subject,
    intro: normalizeOptionalText(input.intro),
    posts,
    siteUrl: getSiteUrl(),
    unsubscribeToken: typeof input.unsubscribeToken === "string" && input.unsubscribeToken ? input.unsubscribeToken : "preview-token",
  });
}

export async function sendNewsletterCampaign(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  await claimCampaignForSending(campaign);

  try {
    let cursorId: string | null = null;
    let subscriberCount = 0;
    let failedCount = 0;

    while (true) {
      const subscribers: Array<Pick<SubscriberRecord, "id" | "email">> = cursorId
        ? await listVerifiedSubscribers(SEND_BATCH_SIZE, cursorId)
        : await listVerifiedSubscribers(SEND_BATCH_SIZE);
      if (subscribers.length === 0) {
        break;
      }

      subscriberCount += subscribers.length;
      cursorId = subscribers[subscribers.length - 1]?.id ?? null;

      const result = await sendCampaignToSubscribers(campaign, subscribers);
      failedCount += result.failedCount;
    }

    const nextStatus: NewsletterCampaignStatus =
      subscriberCount === 0 ? "FAILED" : failedCount === 0 ? "SENT" : "PARTIAL_FAILED";

    return finishSendingCampaign(campaign, nextStatus);
  } catch (error) {
    await markCampaignSendInterrupted(campaign.id);
    throw error;
  }
}

export async function retryNewsletterCampaignFailures(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (campaign.status !== "PARTIAL_FAILED" && campaign.status !== "FAILED") {
    throw new ValidationError("Campaign has no failed deliveries to retry");
  }

  const failedDeliveries = await newsletterClient().newsletterDelivery.findMany({
    where: { campaignId: campaign.id, status: "failed" },
    orderBy: { updatedAt: "asc" },
  });
  const subscriberIds = Array.from(new Set(failedDeliveries.map((delivery) => delivery.subscriberId)));
  const verifiedSubscribers = subscriberIds.length
    ? await newsletterClient().newsletterSubscriber.findMany({
        where: {
          id: { in: subscriberIds },
          status: "verified",
          unsubscribedAt: null,
        },
        select: { id: true, email: true },
      })
    : [];
  const subscriberById = new Map(verifiedSubscribers.map((subscriber) => [subscriber.id, subscriber]));
  const subscribers = failedDeliveries
    .map((delivery) => subscriberById.get(delivery.subscriberId))
    .filter((subscriber): subscriber is Pick<SubscriberRecord, "id" | "email"> => Boolean(subscriber));

  const claimResult = await newsletterClient().newsletterCampaign.updateMany({
    where: { id: campaign.id, status: { in: ["PARTIAL_FAILED", "FAILED"] } },
    data: { status: "SENDING" },
  });
  if (claimResult.count !== 1) {
    throw new ValidationError("Campaign is already being retried");
  }

  try {
    if (subscribers.length === 0 && failedDeliveries.length === 0) {
      return finishSendingCampaign(campaign, "FAILED");
    }

    const result = await sendCampaignToSubscribers(campaign, subscribers);
    const remainingFailedCount = await newsletterClient().newsletterDelivery.count({
      where: { campaignId: campaign.id, status: "failed" },
    });
    const nextStatus: NewsletterCampaignStatus =
      subscribers.length === 0 || result.failedCount > 0 || remainingFailedCount > 0 ? "PARTIAL_FAILED" : "SENT";

    return finishSendingCampaign(campaign, nextStatus);
  } catch (error) {
    await markCampaignSendInterrupted(campaign.id);
    throw error;
  }
}

export async function recoverSendingNewsletterCampaign(campaignId: string) {
  const campaign = await loadCampaign(campaignId);
  if (campaign.status !== "SENDING") {
    throw new ValidationError("Only sending campaigns can be recovered");
  }

  const [sentCount, failedCount] = await Promise.all([
    newsletterClient().newsletterDelivery.count({ where: { campaignId: campaign.id, status: "sent" } }),
    newsletterClient().newsletterDelivery.count({ where: { campaignId: campaign.id, status: "failed" } }),
  ]);
  const nextStatus: NewsletterCampaignStatus = sentCount === 0 && failedCount === 0 ? "DRAFT" : "PARTIAL_FAILED";

  return newsletterClient().newsletterCampaign.update({
    where: { id: campaign.id },
    data: {
      status: nextStatus,
      sentAt: nextStatus === "PARTIAL_FAILED" ? campaign.sentAt ?? new Date() : null,
    },
  });
}

export async function listNewsletterSubscribers(options: ListSubscribersOptions = {}) {
  const where = buildSubscriberWhere(options);
  const total = await newsletterClient().newsletterSubscriber.count({ where });
  const pagination = buildPagination(options.page, options.limit, total);
  const [subscribers, allCount, pendingCount, verifiedCount, unsubscribedCount] = await Promise.all([
    newsletterClient().newsletterSubscriber.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
    newsletterClient().newsletterSubscriber.count({ where: {} }),
    newsletterClient().newsletterSubscriber.count({ where: { status: "pending" } }),
    newsletterClient().newsletterSubscriber.count({ where: { status: "verified", unsubscribedAt: null } }),
    newsletterClient().newsletterSubscriber.count({ where: { OR: [{ status: "unsubscribed" }, { unsubscribedAt: { not: null } }] } }),
  ]);

  return {
    data: subscribers,
    pagination,
    stats: {
      total: allCount,
      pending: pendingCount,
      verified: verifiedCount,
      unsubscribed: unsubscribedCount,
    },
  };
}
