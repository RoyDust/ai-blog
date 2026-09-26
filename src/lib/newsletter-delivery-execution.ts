import { randomUUID } from "node:crypto";
import type { Prisma, NewsletterCampaign, NewsletterDelivery } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { getBlogSettings } from "@/lib/blog-settings";
import { createNewsletterUnsubscribeToken } from "@/lib/newsletter";
import { sendNewsletterEmail } from "@/lib/newsletter-outbound";
import { renderNewsletterEmail } from "@/lib/newsletter-renderer";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/seo";
import { buildDeliveryStats } from "@/lib/newsletter-delivery-stats";

async function lockCampaign(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM newsletter_campaigns WHERE id = ${id} FOR UPDATE`;
  const campaign = await tx.newsletterCampaign.findUnique({ where: { id } });
  if (!campaign) throw new NotFoundError("邮件活动不存在");
  return campaign;
}

async function lockDelivery(tx: Prisma.TransactionClient, campaignId: string, deliveryId: string) {
  await tx.$queryRaw`SELECT id FROM newsletter_deliveries WHERE id = ${deliveryId} AND "campaignId" = ${campaignId} FOR UPDATE`;
  const delivery = await tx.newsletterDelivery.findFirst({ where: { id: deliveryId, campaignId } });
  if (!delivery) throw new NotFoundError("活动收件记录不存在");
  return delivery;
}

async function aggregateCampaign(tx: Prisma.TransactionClient, campaign: NewsletterCampaign) {
  const deliveries = await tx.newsletterDelivery.findMany({ where: { campaignId: campaign.id }, select: { status: true, sentAt: true } });
  const sent = deliveries.some((delivery) => delivery.status === "sent");
  const incomplete = deliveries.some((delivery) => !["sent", "failed", "skipped"].includes(delivery.status));
  const failed = deliveries.some((delivery) => delivery.status === "failed");
  const status = incomplete ? "PARTIAL_FAILED" : failed ? (sent ? "PARTIAL_FAILED" : "FAILED") : sent ? "SENT" : "FAILED";
  const knownSentAt = deliveries.reduce<Date | null>((latest, delivery) => delivery.status === "sent" && delivery.sentAt && (!latest || delivery.sentAt > latest) ? delivery.sentAt : latest, campaign.sentAt);
  const updated = await tx.newsletterCampaign.update({ where: { id: campaign.id }, data: { status, sentAt: sent ? knownSentAt : null } });
  return { ...updated, deliveryStats: buildDeliveryStats(deliveries) };
}

async function claimCampaign(campaignId: string, mode: "pending" | "failed") {
  return prisma.$transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status === "SENDING") throw new ConflictError("活动正在发送，不能重复执行");
    if (campaign.status === "DRAFT" && mode === "pending") {
      if (campaign.audienceFrozenAt || await tx.newsletterDelivery.count({ where: { campaignId } })) {
        throw new ConflictError("历史活动缺少可信受众快照，请人工修复");
      }
      // This single statement snapshots all recipients. SENDING and the complete audience commit together.
      await tx.$executeRaw`INSERT INTO newsletter_deliveries (id, "campaignId", "subscriberId", email, status, "createdAt", "updatedAt")
        SELECT gen_random_uuid()::text, ${campaign.id}, id, email, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM newsletter_subscribers WHERE status = 'verified' AND "verifiedAt" IS NOT NULL AND "unsubscribedAt" IS NULL`;
      return tx.newsletterCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING", audienceFrozenAt: new Date() } });
    }
    if (!campaign.audienceFrozenAt) throw new ConflictError("历史活动未冻结受众，不能按当前订阅者重建，请人工修复");
    if (campaign.status !== "PARTIAL_FAILED" && campaign.status !== "FAILED") throw new ConflictError("当前活动状态不允许发送");
    return tx.newsletterCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING" } });
  });
}

async function beginDelivery(campaignId: string, deliveryId: string, status: "pending" | "failed") {
  return prisma.$transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status !== "SENDING") throw new ConflictError("活动已停止发送");
    const delivery = await lockDelivery(tx, campaignId, deliveryId);
    if (delivery.status !== status) return null;
    const subscriber = await tx.newsletterSubscriber.findUnique({ where: { id: delivery.subscriberId } });
    if (!subscriber || subscriber.status !== "verified" || !subscriber.verifiedAt || subscriber.unsubscribedAt || subscriber.email !== delivery.email) {
      await tx.newsletterDelivery.update({ where: { id: delivery.id }, data: { status: "skipped", error: "订阅已失效、已退订或邮箱已变更" } });
      return null;
    }
    return tx.newsletterDelivery.update({ where: { id: delivery.id }, data: {
      status: "sending", attemptId: randomUUID(), attemptStartedAt: new Date(), error: null, sentAt: null,
      provider: null, providerReceiptId: null, evidenceReference: null, simulated: null,
    } });
  });
}

type DeliveryOutcome = { status: "sent" | "failed" | "unknown"; error: string | null; provider?: string; simulated?: boolean; providerReceiptId?: string };
function mailOutcome(result: unknown): DeliveryOutcome {
  if (!result || typeof result !== "object") return { status: "unknown", error: "适配器未返回可判定的接受结果" };
  const record = result as Record<string, unknown>;
  const provider = typeof record.provider === "string" ? record.provider : undefined;
  const simulated = record.simulated === true || provider === "log";
  if (record.delivered === true) return { status: "sent", error: simulated ? "log 模拟接受，未发送真实邮件" : null, provider, simulated, providerReceiptId: typeof record.providerReceiptId === "string" ? record.providerReceiptId : undefined };
  if (record.delivered === false) return { status: "failed", error: typeof record.reason === "string" ? record.reason : "适配器明确未接受邮件", provider, simulated };
  return { status: "unknown", error: "无法确认上游是否接受邮件", provider, simulated };
}

async function persistOutcome(delivery: NewsletterDelivery, outcome: DeliveryOutcome) {
  return prisma.$transaction(async (tx) => {
    const campaign = await lockCampaign(tx, delivery.campaignId);
    if (campaign.status !== "SENDING") throw new ConflictError("活动已停止发送，结果须人工核对");
    await lockDelivery(tx, delivery.campaignId, delivery.id);
    const updated = await tx.newsletterDelivery.updateMany({
      where: { id: delivery.id, status: "sending", attemptId: delivery.attemptId },
      data: { ...outcome, sentAt: outcome.status === "sent" ? new Date() : null },
    });
    if (updated.count !== 1) throw new ConflictError("发送尝试已变化，结果须人工核对");
  });
}

async function executeCampaign(campaignId: string, mode: "pending" | "failed") {
  const campaign = await claimCampaign(campaignId, mode);
  const { newsletter } = await getBlogSettings();
  const posts = await prisma.post.findMany({ where: { id: { in: campaign.postIds }, deletedAt: null, published: true }, select: { id: true, title: true, slug: true, excerpt: true } });
  const position = new Map(campaign.postIds.map((id, index) => [id, index]));
  posts.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  const deliveries = await prisma.newsletterDelivery.findMany({ where: { campaignId, status: mode }, orderBy: { id: "asc" } });
  for (const target of deliveries) {
    const email = renderNewsletterEmail({ subject: campaign.subject, intro: campaign.intro, posts, siteUrl: getSiteUrl(), unsubscribeToken: createNewsletterUnsubscribeToken(target.email) });
    const attempt = await beginDelivery(campaignId, target.id, mode);
    if (!attempt) continue;
    let outcome: DeliveryOutcome;
    try {
      outcome = mailOutcome(await sendNewsletterEmail({ to: attempt.email, subject: email.subject, html: email.html, text: email.text }, newsletter));
    } catch (error) {
      outcome = { status: "unknown", error: error instanceof Error ? error.message : "上游接受结果未知" };
    }
    // Persistence errors preserve sending. They must never turn accepted mail into a retryable failure.
    await persistOutcome(attempt, outcome);
  }
  return prisma.$transaction(async (tx) => {
    const latest = await lockCampaign(tx, campaignId);
    if (latest.status !== "SENDING") throw new ConflictError("活动状态已变化");
    return aggregateCampaign(tx, latest);
  });
}

export async function sendNewsletterCampaign(campaignId: string) { return executeCampaign(campaignId, "pending"); }
export async function retryNewsletterCampaignFailures(campaignId: string) { return executeCampaign(campaignId, "failed"); }

export async function recoverSendingNewsletterCampaign(campaignId: string, confirmation?: { senderStopped?: unknown }) {
  if (confirmation?.senderStopped !== true) throw new ValidationError("请先确认旧发送进程已经停止");
  return prisma.$transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status !== "SENDING") throw new ConflictError("仅发送中的活动可以恢复");
    if (!campaign.audienceFrozenAt) throw new ConflictError("历史活动未冻结受众，请人工修复；不能重建当前受众");
    await tx.newsletterDelivery.updateMany({ where: { campaignId, status: "sending" }, data: { status: "unknown", error: "旧发送进程已停止，上游接受结果未知，须人工核对" } });
    return aggregateCampaign(tx, campaign);
  });
}

export type ReconcileNewsletterDeliveryInput = {
  attemptId?: unknown; decision?: unknown; reason?: unknown; evidenceKind?: unknown; evidenceReference?: unknown; senderStopped?: unknown;
};
function boundedText(value: unknown, field: string, maximum = 2000) {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError("请填写" + field);
  const text = value.trim();
  if (text.length > maximum) throw new ValidationError(field + "过长");
  return text;
}

export async function reconcileNewsletterDelivery(campaignId: string, deliveryId: string, actorId: string, input: ReconcileNewsletterDeliveryInput) {
  if (input.senderStopped !== true) throw new ValidationError("请先确认旧发送进程已经停止");
  const attemptId = boundedText(input.attemptId, "发送尝试 ID", 128);
  const reason = boundedText(input.reason, "核对原因");
  const decision = input.decision;
  if (decision !== "accepted" && decision !== "not_accepted" && decision !== "abandon") throw new ValidationError("核对决定无效");
  const evidenceKind = decision === "abandon" ? null : boundedText(input.evidenceKind, "上游证据类型", 64);
  const evidenceReference = decision === "abandon" ? null : boundedText(input.evidenceReference, "上游证据引用");
  if (decision === "abandon" && (input.evidenceKind || input.evidenceReference)) throw new ValidationError("放弃发送只记录明确原因，不接受上游证据");
  if ((decision === "accepted" && evidenceKind !== "provider_acceptance") || (decision === "not_accepted" && evidenceKind !== "provider_rejection")) {
    throw new ValidationError("须提供与当前尝试相关的上游明确接受或拒绝凭据；本地日志、超时、Message-ID 和查无记录均不足以核对");
  }
  return prisma.$transaction(async (tx) => {
    const campaign = await lockCampaign(tx, campaignId);
    if (campaign.status === "SENDING") throw new ConflictError("活动正在发送，不能核对");
    const delivery = await lockDelivery(tx, campaignId, deliveryId);
    if (delivery.attemptId !== attemptId) throw new ConflictError("发送尝试已变化，请重新加载");
    const existing = await tx.newsletterDeliveryReconciliation.findUnique({ where: { deliveryId_attemptId: { deliveryId, attemptId } } });
    if (existing) {
      if (existing.decision !== decision || existing.reason !== reason || existing.evidenceKind !== evidenceKind || existing.evidenceReference !== evidenceReference) throw new ConflictError("该尝试已按不同决定核对");
      const deliveries = await tx.newsletterDelivery.findMany({ where: { campaignId }, select: { status: true } });
      return { delivery, reconciliation: existing, campaign: { ...campaign, deliveryStats: buildDeliveryStats(deliveries) } };
    }
    if (delivery.status !== "unknown" || !delivery.attemptStartedAt) throw new ConflictError("仅有真实尝试记录的未知结果可以核对；历史缺失记录须人工修复");
    const status = decision === "accepted" ? "sent" : decision === "not_accepted" ? "failed" : "skipped";
    // A receipt reference proves the decision, but supplies no acceptance timestamp.
    const updated = await tx.newsletterDelivery.updateMany({ where: { id: deliveryId, campaignId, status: "unknown", attemptId }, data: { status, error: reason, evidenceReference, sentAt: status === "sent" ? delivery.sentAt : null } });
    if (updated.count !== 1) throw new ConflictError("发送尝试已变化，请重新加载");
    const reconciliation = await tx.newsletterDeliveryReconciliation.create({ data: { deliveryId, attemptId, actorId: boundedText(actorId, "操作人", 128), decision, reason, evidenceKind, evidenceReference } });
    const aggregate = await aggregateCampaign(tx, campaign);
    return { delivery: await tx.newsletterDelivery.findUniqueOrThrow({ where: { id: deliveryId } }), reconciliation, campaign: aggregate };
  });
}
