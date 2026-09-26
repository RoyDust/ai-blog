import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createNewsletterCampaign, updateNewsletterCampaign, getNewsletterCampaign, sendNewsletterCampaign, recoverSendingNewsletterCampaign, retryNewsletterCampaignFailures, reconcileNewsletterDelivery } from "@/lib/newsletter-campaigns";

const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/newsletter-mailer", () => ({ createNewsletterMailer: () => ({ provider: "log", configured: true, sendCampaignEmail: mail.send }) }));
const campaigns: string[] = [], subscribers: string[] = [];
const triggers: Array<{ table: string; name: string }> = [];
async function rejectWrite(table: string, condition: string) {
  const name = "newsletter_fault_" + randomUUID().replaceAll("-", "");
  await prisma.$executeRawUnsafe('CREATE FUNCTION ' + name + '() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ' + condition + " THEN RAISE EXCEPTION 'newsletter injected fault'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER ' + name + ' BEFORE INSERT OR UPDATE ON ' + table + ' FOR EACH ROW EXECUTE FUNCTION ' + name + '()');
  triggers.push({ table, name });
}
async function removeTriggers() { for (const item of triggers.splice(0)) { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS ' + item.name + ' ON ' + item.table); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS ' + item.name + '()'); } }
async function subscriber() {
  const value = await prisma.newsletterSubscriber.create({ data: { email: randomUUID() + "@newsletter.test", status: "verified", verifiedAt: new Date() } });
  subscribers.push(value.id); return value;
}
async function campaign() {
  const value = await createNewsletterCampaign({ title: "Recovery fixture", subject: "Recovery fixture" });
  campaigns.push(value.id); return value;
}
describe("Newsletter durable audience and attempts", () => {
  test('cannot edit a draft after a concurrent sender claims it', async () => {
    const value = await campaign();
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('UPDATE newsletter_campaigns SET status = $2, "audienceFrozenAt" = NOW() WHERE id = $1', [value.id, 'SENDING']);
      const edit = updateNewsletterCampaign(value.id, { subject: 'late edit' }).then(() => 'changed', (error: { status?: number }) => error.status);
      const deadline = Date.now() + 5000;
      while (true) {
        const pending = await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '%UPDATE%newsletter_campaigns%' AND pid <> pg_backend_pid()");
        if (pending.rowCount) break;
        if (Date.now() > deadline) throw new Error('edit did not reach the campaign write lock');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await blocker.query('COMMIT');
      expect(await edit).toBe(409);
      expect((await getNewsletterCampaign(value.id)).subject).toBe(value.subject);
    } finally { await blocker.query('ROLLBACK'); blocker.release(); await pool.end(); }
  });

  beforeEach(() => { vi.stubEnv("NEWSLETTER_TOKEN_SECRET", "newsletter-integration-secret"); mail.send.mockReset().mockResolvedValue({ delivered: true, provider: "log", simulated: true }); });
  afterEach(async () => {
    await removeTriggers();
    await prisma.newsletterCampaign.deleteMany({ where: { id: { in: campaigns.splice(0) } } });
    await prisma.newsletterSubscriber.deleteMany({ where: { id: { in: subscribers.splice(0) } } });
    vi.unstubAllEnvs();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  test("freezes every verified recipient before calling the first adapter", async () => {
    const first = await subscriber(), second = await subscriber(), value = await campaign();
    let observed: Awaited<ReturnType<typeof getNewsletterCampaign>> | undefined;
    mail.send.mockImplementationOnce(async () => {
      observed = await getNewsletterCampaign(value.id);
      return { delivered: true, provider: "log", simulated: true };
    });
    await sendNewsletterCampaign(value.id);
    expect(observed).toMatchObject({ status: "SENDING", audienceFrozenAt: expect.any(Date) });
    expect(observed?.deliveries?.map((item) => item.subscriberId).sort()).toEqual([first.id, second.id].sort());
    expect(observed?.deliveryStats).toMatchObject({ total: 2, sending: 1, pending: 1 });
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect((await getNewsletterCampaign(value.id)).status).toBe("SENT");
  });

  test("accepted mail with a failed local write stays sending, then recovery continues only pending recipients", async () => {
    await subscriber(); await subscriber(); const value = await campaign();
    mail.send.mockImplementationOnce(async () => {
      await rejectWrite("newsletter_deliveries", `NEW."campaignId" = '${value.id}' AND NEW.status = 'sent'`);
      return { delivered: true, provider: "log" };
    });
    await expect(sendNewsletterCampaign(value.id)).rejects.toThrow();
    let result = await getNewsletterCampaign(value.id);
    expect(result).toMatchObject({ status: "SENDING", deliveryStats: { sending: 1, pending: 1, failed: 0 } });
    await removeTriggers();
    await expect(recoverSendingNewsletterCampaign(value.id)).rejects.toThrow("确认");
    await recoverSendingNewsletterCampaign(value.id, { senderStopped: true });
    await subscriber();
    await sendNewsletterCampaign(value.id);
    result = await getNewsletterCampaign(value.id);
    expect(result).toMatchObject({ status: "PARTIAL_FAILED", deliveryStats: { total: 2, sent: 1, unknown: 1, pending: 0 } });
    expect(mail.send).toHaveBeenCalledTimes(2);
  });

  test("continue and retry select separate frozen sets and recheck unsubscribe", async () => {
    await subscriber(); await subscriber(); await subscriber(); const value = await campaign();
    mail.send.mockResolvedValueOnce({ delivered: false, provider: "noop", reason: "rejected" }).mockImplementationOnce(async () => {
      await rejectWrite("newsletter_deliveries", `NEW."campaignId" = '${value.id}' AND NEW.status = 'sent'`);
      return { delivered: true };
    });
    await expect(sendNewsletterCampaign(value.id)).rejects.toThrow();
    await removeTriggers(); await recoverSendingNewsletterCampaign(value.id, { senderStopped: true });
    const frozen = await getNewsletterCampaign(value.id);
    const pending = frozen.deliveries!.find((item) => item.status === "pending")!;
    await prisma.newsletterSubscriber.update({ where: { id: pending.subscriberId }, data: { status: "unsubscribed", unsubscribedAt: new Date() } });
    await sendNewsletterCampaign(value.id);
    expect(mail.send).toHaveBeenCalledTimes(2);
    expect((await getNewsletterCampaign(value.id)).deliveryStats).toMatchObject({ skipped: 1, failed: 1, unknown: 1 });
    await retryNewsletterCampaignFailures(value.id);
    expect(mail.send).toHaveBeenCalledTimes(3);
    expect((await getNewsletterCampaign(value.id)).deliveryStats).toMatchObject({ skipped: 1, sent: 1, unknown: 1, failed: 0 });
  });

  test("concurrent claims allow only one sender", async () => {
    await subscriber(); const value = await campaign();
    let release!: () => void; let began!: () => void;
    const started = new Promise<void>((resolve) => { began = resolve; });
    mail.send.mockImplementationOnce(async () => { began(); await new Promise<void>((resolve) => { release = resolve; }); return { delivered: true }; });
    const sending = sendNewsletterCampaign(value.id); await started;
    try {
      await expect(sendNewsletterCampaign(value.id)).rejects.toThrow("正在发送");
      await expect(updateNewsletterCampaign(value.id, { subject: "Changed during send" })).rejects.toThrow("Only draft");
    } finally { release(); await sending; }
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  test("snapshots the entire audience beyond the old 500-recipient page and retains simulated outcomes", async () => {
    const rows = Array.from({ length: 501 }, () => ({ id: randomUUID(), email: randomUUID() + "@newsletter.test", status: "verified", verifiedAt: new Date() }));
    subscribers.push(...rows.map((row) => row.id));
    await prisma.newsletterSubscriber.createMany({ data: rows });
    const value = await campaign();
    let frozenCount = 0;
    mail.send.mockImplementationOnce(async () => { frozenCount = (await getNewsletterCampaign(value.id)).deliveryStats.total; return { delivered: true, provider: "log", simulated: true }; });
    await sendNewsletterCampaign(value.id);
    expect(frozenCount).toBe(501); expect(mail.send).toHaveBeenCalledTimes(501);
    const result = await getNewsletterCampaign(value.id);
    expect(result).toMatchObject({ status: "SENT", deliveryStats: { total: 501, sent: 501 } });
    expect(result.deliveries.every((delivery) => delivery.simulated && delivery.error === "log 模拟接受，未发送真实邮件")).toBe(true);
  });

  test("all explicit rejections finish failed and mixed acceptance finishes partial failed", async () => {
    await subscriber(); await subscriber(); const allFailed = await campaign();
    mail.send.mockResolvedValue({ delivered: false, provider: "noop", reason: "provider_not_configured" });
    expect((await sendNewsletterCampaign(allFailed.id)).status).toBe("FAILED");
    const mixed = await campaign(); mail.send.mockResolvedValueOnce({ delivered: true, provider: "log" });
    expect((await sendNewsletterCampaign(mixed.id)).status).toBe("PARTIAL_FAILED");
    expect((await getNewsletterCampaign(mixed.id)).deliveryStats).toMatchObject({ sent: 1, failed: 1, unknown: 0 });
  });

  test("an empty frozen audience and all skipped recipients finish failed", async () => {
    const empty = await campaign(); await sendNewsletterCampaign(empty.id);
    expect(await getNewsletterCampaign(empty.id)).toMatchObject({ status: "FAILED", audienceFrozenAt: expect.any(Date), deliveryStats: { total: 0 } });
    await subscriber(); await sendNewsletterCampaign(empty.id);
    expect(mail.send).not.toHaveBeenCalled();
    const value = await campaign();
    await prisma.newsletterCampaign.update({ where: { id: value.id }, data: { status: "PARTIAL_FAILED", audienceFrozenAt: new Date() } });
    await prisma.newsletterDelivery.create({ data: { campaignId: value.id, subscriberId: subscribers[0], email: "gone@newsletter.test", status: "pending" } });
    expect((await sendNewsletterCampaign(value.id)).status).toBe("FAILED");
    expect((await getNewsletterCampaign(value.id)).deliveryStats.skipped).toBe(1);
  });

  test("legacy interruptions without a frozen audience require manual repair", async () => {
    await subscriber(); const value = await campaign();
    await prisma.newsletterCampaign.update({ where: { id: value.id }, data: { status: "SENDING" } });
    await expect(recoverSendingNewsletterCampaign(value.id, { senderStopped: true })).rejects.toThrow("人工修复");
    expect((await getNewsletterCampaign(value.id)).deliveries).toHaveLength(0);
  });

  async function unknown() {
    await subscriber(); const value = await campaign();
    mail.send.mockRejectedValueOnce(new Error("upstream timeout"));
    await sendNewsletterCampaign(value.id);
    const delivery = (await getNewsletterCampaign(value.id)).deliveries![0];
    return { value, delivery, input: { attemptId: delivery.attemptId, decision: "accepted", reason: "人工核对上游回执", evidenceKind: "provider_acceptance", evidenceReference: "provider:receipt-123", senderStopped: true } };
  }

  test.each([
    ["accepted", "provider_acceptance", "sent", "SENT"],
    ["not_accepted", "provider_rejection", "failed", "FAILED"],
    ["abandon", undefined, "skipped", "FAILED"],
  ])("reconciles %s and durably completes aggregation", async (decision, evidenceKind, status, campaignStatus) => {
    const { value, delivery, input } = await unknown();
    const result = await reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", { ...input, decision, evidenceKind, evidenceReference: decision === "abandon" ? undefined : input.evidenceReference });
    expect(result.delivery.status).toBe(status); expect(result.campaign.status).toBe(campaignStatus);
    expect(result.delivery.sentAt).toBeNull();
    expect(result.campaign.sentAt).toBeNull();
    expect(result.reconciliation.createdAt).toBeInstanceOf(Date);
    expect(result.campaign).toHaveProperty('deliveryStats', { total: 1, pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0, unknown: 0, [status]: 1 });
    expect(result.reconciliation).toMatchObject({ actorId: "admin-fixture", attemptId: delivery.attemptId, reason: input.reason, decision });
  });

  test("insufficient evidence leaves unknown and cannot enter automatic retry", async () => {
    const { value, delivery, input } = await unknown();
    for (const evidenceKind of ["local_log", "message_id", "timeout", "not_found"]) {
      await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", { ...input, evidenceKind })).rejects.toThrow("不足");
    }
    await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", { ...input, evidenceReference: "" })).rejects.toThrow();
    await sendNewsletterCampaign(value.id); await retryNewsletterCampaignFailures(value.id);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect((await getNewsletterCampaign(value.id)).deliveryStats.unknown).toBe(1);
  });

  test("concurrent identical decisions replay one audit; conflicting decisions return conflict", async () => {
    const { value, delivery, input } = await unknown();
    const results = await Promise.all([reconcileNewsletterDelivery(value.id, delivery.id, "admin-a", input), reconcileNewsletterDelivery(value.id, delivery.id, "admin-b", input)]);
    expect(results[0].reconciliation.id).toBe(results[1].reconciliation.id);
    for (const result of results) {
      expect(result.delivery.sentAt).toBeNull();
      expect(result.campaign).toHaveProperty('deliveryStats', { total: 1, pending: 0, sending: 0, sent: 1, failed: 0, skipped: 0, unknown: 0 });
    }
    for (const changed of [{ reason: "changed" }, { evidenceReference: "another-receipt" }, { decision: "not_accepted", evidenceKind: "provider_rejection" }]) {
      await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", { ...input, ...changed })).rejects.toMatchObject({ status: 409 });
    }
    expect(await prisma.newsletterDeliveryReconciliation.count({ where: { deliveryId: delivery.id } })).toBe(1);
  });

  test("concurrent conflicting decisions produce exactly one audit and one conflict", async () => {
    const { value, delivery, input } = await unknown();
    const results = await Promise.allSettled([
      reconcileNewsletterDelivery(value.id, delivery.id, "admin-a", input),
      reconcileNewsletterDelivery(value.id, delivery.id, "admin-b", { ...input, decision: "abandon", evidenceKind: undefined, evidenceReference: undefined }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await prisma.newsletterDeliveryReconciliation.count({ where: { deliveryId: delivery.id } })).toBe(1);
  });

  test("rejects incomplete reconciliation input without changing unknown state", async () => {
    const { value, delivery, input } = await unknown();
    for (const invalid of [{ senderStopped: false }, { attemptId: "" }, { reason: "" }, { reason: "x".repeat(2001) }, { decision: "resend" }, { evidenceReference: "" }]) {
      await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", { ...input, ...invalid })).rejects.toMatchObject({ status: 400 });
    }
    expect((await getNewsletterCampaign(value.id)).deliveryStats.unknown).toBe(1);
    expect(await prisma.newsletterDeliveryReconciliation.count({ where: { deliveryId: delivery.id } })).toBe(0);
  });

  test("old attempt decisions cannot mutate a newer attempt", async () => {
    const { value, delivery, input } = await unknown();
    const rejected = { ...input, decision: "not_accepted", evidenceKind: "provider_rejection" };
    await reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", rejected);
    mail.send.mockRejectedValueOnce(new Error("second timeout")); await retryNewsletterCampaignFailures(value.id);
    const current = (await getNewsletterCampaign(value.id)).deliveries![0];
    expect(current.attemptId).not.toBe(delivery.attemptId);
    await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", rejected)).rejects.toMatchObject({ status: 409 });
    expect((await getNewsletterCampaign(value.id)).deliveryStats.unknown).toBe(1);
  });

  test("audit write failure rolls back delivery and campaign", async () => {
    const { value, delivery, input } = await unknown();
    await rejectWrite("newsletter_delivery_reconciliations", `NEW."deliveryId" = '${delivery.id}'`);
    await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", input)).rejects.toThrow();
    expect(await getNewsletterCampaign(value.id)).toMatchObject({ status: "PARTIAL_FAILED", deliveryStats: { unknown: 1, sent: 0 } });
    expect(await prisma.newsletterDeliveryReconciliation.count({ where: { deliveryId: delivery.id } })).toBe(0);
  });

  test("rejects cross-campaign reconciliation, active senders and missing legacy attempts", async () => {
    const { value, delivery, input } = await unknown(); const other = await campaign();
    await expect(reconcileNewsletterDelivery(other.id, delivery.id, "admin-fixture", input)).rejects.toMatchObject({ status: 404 });
    await prisma.newsletterCampaign.update({ where: { id: value.id }, data: { status: "SENDING" } });
    await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", input)).rejects.toMatchObject({ status: 409 });
    await recoverSendingNewsletterCampaign(value.id, { senderStopped: true });
    await prisma.newsletterDelivery.update({ where: { id: delivery.id }, data: { attemptStartedAt: null } });
    await expect(reconcileNewsletterDelivery(value.id, delivery.id, "admin-fixture", input)).rejects.toThrow("历史");
  });
});
