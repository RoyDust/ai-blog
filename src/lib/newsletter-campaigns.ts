import type { Prisma, NewsletterDelivery as DeliveryRecord, NewsletterCampaign as CampaignRecord } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { buildDeliveryStats, type DeliveryStats } from "@/lib/newsletter-delivery-stats";



import { prisma } from "@/lib/prisma";
import { renderNewsletterEmail } from "@/lib/newsletter-renderer";
import { getSiteUrl } from "@/lib/seo";

type NewsletterCampaignStatus = "DRAFT" | "SENDING" | "SENT" | "PARTIAL_FAILED" | "FAILED";


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

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const allowedCampaignStatuses = new Set<NewsletterCampaignStatus>([
  "DRAFT",
  "SENDING",
  "SENT",
  "PARTIAL_FAILED",
  "FAILED",
]);
const allowedSubscriberStatuses = new Set(["pending", "verified", "unsubscribed"]);

function newsletterClient() {
  return prisma;
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

function buildCampaignWhere(options: ListCampaignsOptions): Prisma.NewsletterCampaignWhereInput {
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

function buildSubscriberWhere(options: ListSubscribersOptions): Prisma.NewsletterSubscriberWhereInput {
  const status = normalizeSubscriberStatus(options.status);
  const query = typeof options.q === "string" ? options.q.trim() : "";

  return {
    ...(status ? { status } : {}),
    ...(status === "verified" ? { unsubscribedAt: null } : {}),
    ...(query ? { email: { contains: query, mode: "insensitive" } } : {}),
  };
}

function toPublicCampaign<T extends CampaignRecord & { deliveries?: Array<Pick<DeliveryRecord, "status">>; deliveryStats?: DeliveryStats }>(campaign: T) {
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
    where: { id: campaign.id, status: "DRAFT", audienceFrozenAt: null },
    data: {
      ...(input.title !== undefined ? { title: normalizeText(input.title, "Title") } : {}),
      ...(input.subject !== undefined ? { subject: normalizeText(input.subject, "Subject") } : {}),
      ...(input.intro !== undefined ? { intro: normalizeOptionalText(input.intro) } : {}),
      ...(input.postIds !== undefined ? { postIds: normalizePostIds(input.postIds) } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: normalizeDate(input.scheduledAt) } : {}),
    },
  }).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      throw new ConflictError("活动已开始发送或状态已变化，不能修改草稿");
    }
    throw error;
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
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: normalizeText(campaignId, "Campaign ID") },
    include: { deliveries: { orderBy: [{ updatedAt: "desc" }, { id: "asc" }] } },
  });
  if (!campaign) throw new NotFoundError("Campaign not found");
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

export { sendNewsletterCampaign, retryNewsletterCampaignFailures, recoverSendingNewsletterCampaign, reconcileNewsletterDelivery } from "@/lib/newsletter-delivery-execution";

export { sendNewsletterEmail, type NewsletterOutboundMessage } from "@/lib/newsletter-outbound";
