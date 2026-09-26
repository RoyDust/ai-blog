import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAiTask, markAiTaskRunning, markAiTaskItemRunning, refreshAiTaskCounts } from "@/lib/ai-tasks";
import { applyPostAiTaskItem, buildPostAiInputSnapshot, completePostAiTaskItem, getPostForAiAction, type PostAiAction } from "@/lib/ai-post-actions";

const cache = vi.hoisted(() => ({ refresh: vi.fn(() => ({ paths: ["/posts/test"], errors: [] as Array<{ path: string; error: string }> })), generate: vi.fn(async () => "Summary result") }));
vi.mock("@/lib/cache", async (original) => ({
  ...await original<typeof import("@/lib/cache")>(),
  revalidatePublicContentStrict: cache.refresh,
  revalidatePublicContent: vi.fn(),
}));
vi.mock("@/lib/ai-models", () => ({ getAiModelForCapability: async () => ({ id: "model-fixture", apiKey: "test" }), getAiModelChatRequestExtras: () => ({}) }));
vi.mock("@/lib/post-summary", () => ({ generatePostSummary: cache.generate, getPostSummaryMaxInputChars: () => 1000 }));

const users: string[] = [], tasks: string[] = [];
const triggers: Array<{ table: string; name: string }> = [];
async function user(role: "ADMIN" | "USER" = "USER") {
  const result = await prisma.user.create({ data: { email: randomUUID() + "@atomicity.test", role } });
  users.push(result.id); return result;
}
async function fixture(action: PostAiAction = "seo-description") {
  const author = await user(); await user("ADMIN");
  const created = await prisma.post.create({ data: { title: "Original", content: "first body", slug: "atomic-" + randomUUID(), authorId: author.id, published: true } });
  const post = await getPostForAiAction(created.id);
  const snapshot = buildPostAiInputSnapshot(post, action);
  const task = await createAiTask({ type: "post-bulk-completion", source: "bulk-posts", items: [{ postId: post.id, action, inputSnapshot: snapshot }] });
  tasks.push(task.id);
  await markAiTaskRunning(task.id); await markAiTaskItemRunning(task.items[0].id);
  return { taskId: task.id, itemId: task.items[0].id, post, action, expectedInputSnapshot: snapshot, output: { seoDescription: "Generated description" }, modelId: "model-fixture", apply: true };
}
async function rejectWrite(table: string, condition = "true") {
  const name = "ai_atomicity_" + randomUUID().replaceAll("-", "");
  await prisma.$executeRawUnsafe('CREATE FUNCTION ' + name + '() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ' + condition + " THEN RAISE EXCEPTION 'atomicity injected fault'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER ' + name + ' BEFORE INSERT OR UPDATE ON ' + table + ' FOR EACH ROW EXECUTE FUNCTION ' + name + '()');
  triggers.push({ table, name });
}
async function removeTriggers() { for (const entry of triggers.splice(0)) { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS ' + entry.name + ' ON ' + entry.table); await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS ' + entry.name + '()'); } }
async function state(input: Awaited<ReturnType<typeof fixture>>) {
  const [post, item, task, notifications] = await Promise.all([
    prisma.post.findUniqueOrThrow({ where: { id: input.post.id } }), prisma.aiTaskItem.findUniqueOrThrow({ where: { id: input.itemId } }),
    prisma.aiTask.findUniqueOrThrow({ where: { id: input.taskId } }), prisma.notification.findMany({ where: { entityType: "aiTask", entityId: input.taskId }, include: { recipients: true } }),
  ]); return { post, item, task, notifications };
}

describe("AI application atomicity against PostgreSQL", () => {
  beforeEach(() => { cache.refresh.mockReset().mockReturnValue({ paths: ["/posts/test"], errors: [] }); cache.generate.mockReset().mockResolvedValue("Summary result"); });
  afterEach(async () => {
    await removeTriggers();
    await prisma.notification.deleteMany({ where: { entityType: "aiTask", entityId: { in: tasks } } });
    await prisma.aiTask.deleteMany({ where: { id: { in: tasks.splice(0) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  test("applies output and commits item, aggregate, notification and recipients as one result", async () => {
    const input = await fixture(); await completePostAiTaskItem(input);
    const actual = await state(input);
    expect(actual.post.seoDescription).toBe("Generated description");
    expect(actual.item).toMatchObject({ status: "SUCCEEDED", applied: true, finishedAt: expect.any(Date) });
    expect(actual.task).toMatchObject({ status: "SUCCEEDED", succeededCount: 1, failedCount: 0 });
    expect(actual.notifications).toHaveLength(1);
    expect(actual.notifications[0].dedupeKey).toBe("ai-task:" + input.taskId + ":SUCCEEDED");
    expect(actual.notifications[0].recipients).toHaveLength(1);
  });

  test.each(["notifications", "notification_recipients", "ai_tasks"])("rolls back post and active item when %s fails, then recovers", async (table) => {
    const input = await fixture();
    await rejectWrite(table, table === "ai_tasks" ? "NEW.status = 'SUCCEEDED'" : "true");
    await expect(completePostAiTaskItem(input)).rejects.toThrow();
    let actual = await state(input);
    expect(actual.post.seoDescription).toBeNull();
    expect(actual.item).toMatchObject({ status: "RUNNING", applied: false, output: null, finishedAt: null });
    expect(actual.task).toMatchObject({ status: "RUNNING", succeededCount: 0 });
    expect(actual.notifications).toHaveLength(0);
    expect(cache.refresh).not.toHaveBeenCalled();
    await removeTriggers(); await completePostAiTaskItem(input);
    actual = await state(input); expect(actual.item.applied).toBe(true); expect(actual.notifications).toHaveLength(1);
  });

  test.each(["content", "seoDescription", "authorId", "deletedAt"])("skips stale output after %s changes", async (field) => {
    const input = await fixture();
    const value = field === "authorId" ? (await user()).id : field === "deletedAt" ? new Date() : "manual edit";
    await prisma.post.update({ where: { id: input.post.id }, data: { [field]: value } });
    await completePostAiTaskItem(input);
    const actual = await state(input);
    expect(actual.item).toMatchObject({ status: "SKIPPED", applied: false, error: expect.stringContaining("发生变化") });
    expect(actual.post.seoDescription).toBe(field === "seoDescription" ? "manual edit" : null);
  });

  test("concurrent completions produce one immutable notification without late recipients", async () => {
    const input = await fixture();
    await Promise.all([completePostAiTaskItem(input), completePostAiTaskItem(input)]);
    const original = await state(input);
    const notification = original.notifications[0];
    const readAt = new Date("2026-09-20T10:00:00Z");
    await prisma.notificationRecipient.update({ where: { id: notification.recipients[0].id }, data: { readAt } });
    await user("ADMIN");
    await completePostAiTaskItem({ ...input, output: { seoDescription: "duplicate output" } });
    await refreshAiTaskCounts(input.taskId);
    const actual = await state(input);
    expect(actual.post.seoDescription).toBe("Generated description");
    expect(actual.task.finishedAt).toEqual(original.task.finishedAt);
    expect(actual.notifications).toHaveLength(1);
    expect(actual.notifications[0].recipients).toHaveLength(1);
    expect(actual.notifications[0].recipients[0].readAt).toEqual(readAt);
    expect(actual.notifications[0].body).toBe(notification.body);
  });

  test("keeps non-whitelisted output as a suggestion and manual apply does not redeliver", async () => {
    const input = await fixture("title");
    await completePostAiTaskItem({ ...input, output: { titles: ["Suggested title"] } });
    const before = await state(input);
    expect(before.item).toMatchObject({ status: "SUCCEEDED", applied: false });
    expect(before.post.title).toBe("Original");
    await user("ADMIN"); await applyPostAiTaskItem(input.itemId);
    const after = await state(input);
    expect(after.post.title).toBe("Suggested title"); expect(after.item.applied).toBe(true);
    expect(after.task).toEqual(before.task); expect(after.notifications).toEqual(before.notifications);
  });

  test("manual flag failure rolls back the article while retaining the successful suggestion", async () => {
    const input = await fixture(); await completePostAiTaskItem({ ...input, apply: false });
    await rejectWrite("ai_task_items", "NEW.applied = true");
    await expect(applyPostAiTaskItem(input.itemId)).rejects.toThrow();
    const actual = await state(input);
    expect(actual.post.seoDescription).toBeNull(); expect(actual.item).toMatchObject({ status: "SUCCEEDED", applied: false });
    expect(actual.notifications).toHaveLength(1);
  });

  test("cache failure cannot undo committed success", async () => {
    const input = await fixture(); cache.refresh.mockReturnValue({ paths: ["/posts/test"], errors: [{ path: "/posts/test", error: "cache unavailable" }] });
    const result = await completePostAiTaskItem(input); expect(result).toMatchObject({ applied: true, cache: { errors: [{ path: "/posts/test", error: "cache unavailable" }] } });
    const actual = await state(input); expect(actual.item.status).toBe("SUCCEEDED"); expect(actual.notifications).toHaveLength(1);
  });

  test("preserves the legacy summary job for recovery when terminal delivery fails", async () => {
    const input = await fixture("summary");
    await prisma.post.update({ where: { id: input.post.id }, data: { summaryJobId: input.taskId, summaryStatus: "QUEUED" } });
    const { runPostSummaryJob } = await import("@/lib/post-summary-jobs");
    await rejectWrite("notification_recipients");
    await expect(runPostSummaryJob(input.taskId, "model-fixture")).rejects.toThrow();
    const failed = await state(input);
    expect(failed.post).toMatchObject({ excerpt: null, summaryStatus: "GENERATING" });
    expect(failed.item).toMatchObject({ status: "RUNNING", applied: false });
    await removeTriggers();
    await runPostSummaryJob(input.taskId, "model-fixture");
    const recovered = await state(input);
    expect(recovered.post.excerpt).toBe("Summary result");
    expect(recovered.item).toMatchObject({ status: "SUCCEEDED", applied: true });
  });

  test("the batch runner keeps infrastructure failures recoverable but records model failures", async () => {
    const input = await fixture("summary");
    const { runAiBatchTask } = await import("@/lib/ai-batch-jobs");
    await rejectWrite("notification_recipients");
    await expect(runAiBatchTask({ taskId: input.taskId, apply: true })).rejects.toThrow();
    expect((await state(input)).item).toMatchObject({ status: "RUNNING", applied: false });
    await removeTriggers();
    cache.generate.mockRejectedValueOnce(new Error("model timeout"));
    await runAiBatchTask({ taskId: input.taskId, apply: true });
    const actual = await state(input);
    expect(actual.item).toMatchObject({ status: "FAILED", error: "model timeout", applied: false });
    expect(actual.post.excerpt).toBeNull();
    expect(actual.task.status).toBe("FAILED");
  });

  test("does not overwrite an item moved to another task during generation", async () => {
    const input = await fixture();
    const other = await createAiTask({ type: "post-bulk-completion", source: "bulk-posts", items: [{ action: "title", postId: input.post.id }] });
    tasks.push(other.id);
    await prisma.aiTaskItem.update({ where: { id: input.itemId }, data: { taskId: other.id } });
    expect(await completePostAiTaskItem(input)).toBeNull();
    const actual = await state(input);
    expect(actual.item).toMatchObject({ taskId: other.id, status: "RUNNING", output: null, applied: false });
    expect(actual.post.seoDescription).toBeNull();
    expect(actual.notifications).toHaveLength(0);
  });
});
