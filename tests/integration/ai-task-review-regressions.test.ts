import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAiTask } from "@/lib/ai-tasks";
import { buildPostAiInputSnapshot, getPostForAiAction } from "@/lib/ai-post-actions";
import { runAiBatchTask } from "@/lib/ai-batch-jobs";
import { createPostSummaryJob, runPostSummaryJob } from "@/lib/post-summary-jobs";
import { revalidateAiTaskContent } from "@/lib/ai-task-cache-recovery";
import { POST as articleInfo } from "@/app/api/admin/ai/actions/article-info/route";

const mocks = vi.hoisted(() => ({
  cache: vi.fn(), model: vi.fn(), summary: vi.fn(), completion: vi.fn(), upload: vi.fn(), session: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.cache }));
vi.mock("@/lib/ai-models", () => ({ getAiModelForCapability: mocks.model, getAiModelChatRequestExtras: () => ({}) }));
vi.mock("@/lib/post-summary", () => ({ generatePostSummary: mocks.summary, getPostSummaryMaxInputChars: () => 1000 }));
vi.mock("@/lib/openai-compatible-completion-client", () => ({ createCompletionClientForModel: () => ({ completeText: mocks.completion }) }));
vi.mock("@/lib/qiniu-server", () => ({ uploadBufferToQiniu: mocks.upload }));
vi.mock("@/lib/api-auth", () => ({ requireAdminSession: mocks.session }));
vi.mock("@/lib/api-operation-log-route", () => ({ withApiOperationLogging: (handler: unknown) => handler }));

const users: string[] = [], tasks: string[] = [], assetUrls: string[] = [], tagIds: string[] = [], categoryIds: string[] = [], seriesIds: string[] = [];
const triggers: string[] = [];
let tagId = "", categorySlug = "";
const body = "This article contains enough original text to generate complete article information safely.";

async function fixturePost() {
  const author = await prisma.user.create({ data: { email: randomUUID() + "@ai-review.test", role: "ADMIN" } });
  users.push(author.id);
  mocks.session.mockResolvedValue({ user: { id: author.id, role: "ADMIN" } });
  return prisma.post.create({ data: { title: "Review regression", content: body, slug: "ai-review-" + randomUUID(), authorId: author.id, published: true } });
}
async function coverTask() {
  const created = await fixturePost();
  const post = await getPostForAiAction(created.id);
  const task = await createAiTask({ type: "post-cover-image", source: "single-post", createdById: post.authorId, items: [{ postId: post.id, action: "cover-image", inputSnapshot: buildPostAiInputSnapshot(post, "cover-image") }] });
  tasks.push(task.id);
  return { post, task };
}
async function removeTriggers() {
  for (const name of triggers.splice(0)) {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS ' + name + ' ON cover_assets');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS ' + name + '()');
  }
}
async function rejectAsset(url: string) {
  const name = "ai_review_" + randomUUID().replaceAll("-", "");
  await prisma.$executeRawUnsafe('CREATE FUNCTION ' + name + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.url = '" + url + "' THEN RAISE EXCEPTION 'cover asset injected failure'; END IF; RETURN NEW; END $$");
  await prisma.$executeRawUnsafe('CREATE TRIGGER ' + name + ' BEFORE INSERT ON cover_assets FOR EACH ROW EXECUTE FUNCTION ' + name + '()');
  triggers.push(name);
}
async function taxonomy() {
  const tag = await prisma.tag.create({ data: { name: "AI Review " + randomUUID(), slug: "ai-review-" + randomUUID() } });
  const category = await prisma.category.create({ data: { name: "AI Review " + randomUUID(), slug: "ai-review-" + randomUUID() } });
  tagIds.push(tag.id); categoryIds.push(category.id); tagId = tag.id; categorySlug = category.slug;
  return { tag, category };
}
function completionFor(messages: Array<{ content: string }>) {
  const system = messages[0].content;
  if (system.includes("slug")) return { text: "generated-slug" };
  if (system.includes("SEO")) return { text: "Generated SEO description" };
  if (system.includes("分类")) return { text: JSON.stringify({ categorySlug }) };
  return { text: JSON.stringify({ tagIds: [tagId] }) };
}
function infoRequest(postId: string, draft?: { title: string; content: string }) {
  return new Request("http://localhost/api/admin/ai/actions/article-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, ...(draft ? { draft } : {}) }) });
}

describe("AI review regressions against PostgreSQL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cache.mockReset(); mocks.summary.mockReset().mockResolvedValue("Generated summary");
    mocks.model.mockReset().mockResolvedValue({ id: "review-model", name: "Review model", apiKey: "test", apiKeyEnv: "TEST", baseUrl: "https://model.test/v1", requestPath: "/images/generations", model: "review" });
    mocks.completion.mockReset().mockImplementation(async (messages: Array<{ content: string }>) => completionFor(messages));
    const key = "covers/ai/review-" + randomUUID() + ".png";
    const url = "https://review-cdn.test/" + key;
    assetUrls.push(url); mocks.upload.mockReset().mockResolvedValue({ key, url });
    vi.stubEnv("QINIU_DOMAIN", "https://review-cdn.test");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [{ b64_json: Buffer.from("image").toString("base64") }] })));
  });
  afterEach(async () => {
    vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
    await removeTriggers();
    const ownedTasks = await prisma.aiTask.findMany({ where: { OR: [{ id: { in: tasks } }, { createdById: { in: users } }] }, select: { id: true } });
    const ids = ownedTasks.map((task) => task.id);
    await prisma.notification.deleteMany({ where: { entityType: "aiTask", entityId: { in: ids } } });
    await prisma.aiTask.deleteMany({ where: { id: { in: ids } } }); tasks.length = 0;
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } });
    await prisma.coverAsset.deleteMany({ where: { url: { in: assetUrls.splice(0) } } });
    await prisma.tag.deleteMany({ where: { id: { in: tagIds.splice(0) } } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds.splice(0) } } });
    await prisma.series.deleteMany({ where: { id: { in: seriesIds.splice(0) } } });
  });
  afterAll(async () => { await prisma.$disconnect(); });

  test("finishes both legacy summary items after the first cache refresh fails and records recoverable paths", async () => {
    const first = await fixturePost();
    const { tag, category } = await taxonomy();
    const series = await prisma.series.create({ data: { title: "Review series", slug: "ai-review-" + randomUUID() } }); seriesIds.push(series.id);
    await prisma.post.update({ where: { id: first.id }, data: { categoryId: category.id, seriesId: series.id, tags: { connect: { id: tag.id } } } });
    const second = await prisma.post.create({ data: { title: "Second item", content: body, slug: "ai-review-" + randomUUID(), authorId: first.authorId, published: true } });
    const nativeTimeout = globalThis.setTimeout;
    const schedule = vi.spyOn(globalThis, "setTimeout").mockImplementation((callback, delay, ...args) => delay === 0 ? 0 as unknown as ReturnType<typeof setTimeout> : nativeTimeout(callback, delay, ...args));
    const job = await createPostSummaryJob({ ids: [first.id, second.id], modelId: "review-model" });
    schedule.mockRestore(); tasks.push(job.jobId);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.cache.mockImplementationOnce(() => { throw new Error("first path unavailable"); });
    await runPostSummaryJob(job.jobId, "review-model");
    const actual = await prisma.aiTask.findUniqueOrThrow({ where: { id: job.jobId }, include: { items: true } });
    expect(actual).toMatchObject({ status: "SUCCEEDED", succeededCount: 2, failedCount: 0 });
    expect(actual.items.every((item) => item.status === "SUCCEEDED" && item.applied)).toBe(true);
    const posts = await prisma.post.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(posts.every((post) => post.excerpt === "Generated summary" && post.summaryStatus === "GENERATED")).toBe(true);
    expect(errorLog).toHaveBeenCalledWith("Summary cache refresh incomplete", expect.objectContaining({ taskId: job.jobId, postId: first.id, errors: [{ path: "/", error: "first path unavailable" }] }));
    const snapshot = actual.items.find((item) => item.postId === first.id)?.inputSnapshot;
    expect(snapshot).toMatchObject({ published: true, slug: first.slug, categorySlug: category.slug, tagSlugs: [tag.slug], seriesSlug: series.slug });
    const before = actual;
    const currentSlug = first.slug + "-renamed";
    await prisma.post.update({ where: { id: first.id }, data: { slug: currentSlug, categoryId: null, seriesId: null, tags: { set: [] } } });
    const report = await revalidateAiTaskContent(job.jobId);
    expect(report).toMatchObject({ complete: true, errors: [], missingEvidence: [] });
    expect(report.paths).toEqual(expect.arrayContaining(["/posts/" + first.slug, "/posts/" + currentSlug, "/posts/" + second.slug, "/categories/" + category.slug, "/tags/" + tag.slug, "/series/" + series.slug]));
    expect(await prisma.aiTask.findUniqueOrThrow({ where: { id: job.jobId }, include: { items: true } })).toEqual(before);
  });

  test("leaves a cover item RUNNING after asset persistence fails and succeeds when retried", async () => {
    const { post, task } = await coverTask();
    const url = assetUrls[assetUrls.length - 1]; await rejectAsset(url);
    await expect(runAiBatchTask({ taskId: task.id, apply: true })).rejects.toMatchObject({ name: "AiInfrastructureError", cause: expect.any(Error) });
    expect(await prisma.aiTaskItem.findUniqueOrThrow({ where: { id: task.items[0].id } })).toMatchObject({ status: "RUNNING", output: null, applied: false, error: null, finishedAt: null });
    expect(await prisma.aiTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: "RUNNING", failedCount: 0 });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).coverImage).toBeNull();
    expect(await prisma.coverAsset.count({ where: { url } })).toBe(0);
    await removeTriggers(); await runAiBatchTask({ taskId: task.id, apply: true });
    expect(await prisma.aiTaskItem.findUniqueOrThrow({ where: { id: task.items[0].id } })).toMatchObject({ status: "SUCCEEDED", applied: true });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).coverImage).toBe(url);
  });

  test("marks an explicit cover model rejection FAILED without creating an asset", async () => {
    const { post, task } = await coverTask();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Image model rejected request" } }, { status: 400 })));
    await runAiBatchTask({ taskId: task.id, apply: true });
    expect(await prisma.aiTaskItem.findUniqueOrThrow({ where: { id: task.items[0].id } })).toMatchObject({ status: "FAILED", applied: false, error: "Image model rejected request" });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).coverImage).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  test.each(["content", "seoDescription", "deletedAt"])("omits stale persisted article-info output after %s changes during the model call", async (field) => {
    const post = await fixturePost(); await taxonomy();
    mocks.completion.mockImplementationOnce(async (messages: Array<{ content: string }>) => {
      await prisma.post.update({ where: { id: post.id }, data: { [field]: field === "deletedAt" ? new Date() : "manual change" } });
      return completionFor(messages);
    });
    const response = await articleInfo(infoRequest(post.id)); const payload = await response.json();
    expect(response.status).toBe(502); expect(payload).toMatchObject({ success: false, data: { partial: true, items: [] } });
    expect(payload.data.articleInfo).toBeUndefined();
    const task = await prisma.aiTask.findUniqueOrThrow({ where: { id: payload.data.taskId }, include: { items: true } });
    expect(task.items).toHaveLength(5);
    expect(task.items.every((item) => item.status === "SKIPPED" && !item.applied)).toBe(true);
    expect(task.metadata).toMatchObject({ draft: false, partial: true, successfulFields: { slug: "", excerpt: "", seoDescription: "" } });
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))[field as "content" | "seoDescription" | "deletedAt"]).toEqual(field === "deletedAt" ? expect.any(Date) : "manual change");
  });

  test("keeps explicit editor drafts as usable suggestions when the persisted article changes", async () => {
    const post = await fixturePost(); await taxonomy();
    mocks.completion.mockImplementationOnce(async (messages: Array<{ content: string }>) => {
      await prisma.post.update({ where: { id: post.id }, data: { content: "persisted article changed independently" } });
      return completionFor(messages);
    });
    const response = await articleInfo(infoRequest(post.id, { title: "Draft title", content: body + " Editor changes." })); const payload = await response.json();
    expect(response.status).toBe(200); expect(payload.data.items).toHaveLength(5);
    expect(payload.data.articleInfo).toMatchObject({ slug: "generated-slug", excerpt: "Generated summary", seoDescription: "Generated SEO description" });
    const task = await prisma.aiTask.findUniqueOrThrow({ where: { id: payload.data.taskId }, include: { items: true } });
    expect(task.items.every((item) => item.status === "SUCCEEDED" && !item.applied)).toBe(true);
    expect(task.metadata).toMatchObject({ draft: true });
    expect(task.items.every((item) => (item.inputSnapshot as { draft?: boolean }).draft === true)).toBe(true);
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).content).toBe("persisted article changed independently");
  });
});
