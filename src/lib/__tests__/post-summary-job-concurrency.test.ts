import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const db = vi.hoisted(() => {
  const post: Record<string, unknown> = {};
  const task: Record<string, unknown> = {};
  const item: Record<string, unknown> = {};
  function matches(where: Record<string, unknown>) {
    return Object.entries(where).every(([key, expected]) => {
      if (expected && typeof expected === "object" && "in" in expected) {
        return (expected.in as unknown[]).includes(post[key]);
      }
      return post[key] === expected;
    });
  }
  const update = vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    if (!matches(where)) return { count: 0 };
    Object.assign(post, data);
    return { ...post, count: 1 };
  });
  return {
    post, task, item,
    findPosts: vi.fn(async ({ where }: { where: Record<string, unknown> }) => matches(where) ? [{ ...post }] : []),
    update, revalidate: vi.fn(), findModel: vi.fn(async () => null),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: db.revalidate }));
vi.mock("@/lib/prisma", () => {
  const client = {
    $queryRawUnsafe: async () => [],
    post: { findMany: db.findPosts, update: db.update, updateMany: db.update },
    aiModel: { findMany: async () => [], findUnique: db.findModel, count: async () => 0 },
    aiTask: {
      findUnique: async () => ({ ...db.task, items: [{ ...db.item }] }),
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(db.task, data),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(db.task, data); return { count: 1 }; },
    },
    aiTaskItem: {
      findMany: async () => [{ ...db.item }],
      findUnique: async () => ({ ...db.item }),
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(db.item, data),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(db.item, data); return { count: 1 }; },
    },
    notification: { findUnique: async () => null, create: async () => ({ id: "notice-1" }) },
    user: { findMany: async () => [] },
  };
  return { prisma: { ...client, $transaction: async (work: (tx: typeof client) => unknown) => {
    const before = structuredClone({ post: db.post, task: db.task, item: db.item });
    try { return await work(client); } catch (error) { Object.assign(db.post, before.post); Object.assign(db.task, before.task); Object.assign(db.item, before.item); throw error; }
  } } };
});

import { getAiTaskDetail } from "@/lib/ai-tasks";
import { getPostSummaryJobSnapshot, runPostSummaryJob } from "@/lib/post-summary-jobs";

const modelId = "post-summary-openai-compatible";
const completion = () => Response.json({ choices: [{ message: { content: "旧任务生成的摘要" } }] });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("summary job ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AI_OPENAI_COMPAT_API_KEY", "test-key");
    vi.stubEnv("AI_OPENAI_COMPAT_BASE_URL", "http://summary.test/v1");
    vi.stubEnv("AI_OPENAI_COMPAT_MODEL", "test-model");
    Object.assign(db.post, {
      id: "post-1", title: "原始标题", content: "原始正文", excerpt: "原始摘要",
      slug: "post-one", category: null, tags: [], deletedAt: null,
      summaryJobId: "old-job", summaryStatus: "QUEUED",
      summaryError: null, summaryModelId: modelId, summaryGeneratedAt: null,
    });
    Object.assign(db.task, { id: "old-job", status: "QUEUED", succeededCount: 0, failedCount: 0 });
    Object.assign(db.item, { id: "item-1", taskId: "old-job", postId: "post-1", status: "QUEUED", applied: false, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("discards a late response after a new job takes ownership", async () => {
    const started = deferred<void>();
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => { started.resolve(); return response.promise; }));
    const running = runPostSummaryJob("old-job", modelId);
    await started.promise;
    Object.assign(db.post, { summaryJobId: "new-job", summaryStatus: "QUEUED", summaryModelId: "new-model" });
    response.resolve(completion());
    await running;

    const snapshot = await getPostSummaryJobSnapshot("new-job");
    expect(snapshot.posts[0]).toMatchObject({ excerpt: "原始摘要", summaryStatus: "QUEUED", summaryModelId: "new-model" });
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
    expect(db.revalidate).not.toHaveBeenCalled();
  });

  test.each([
    { field: "content", value: "编辑后的正文" },
    { field: "title", value: "编辑后的标题" },
    { field: "excerpt", value: "手工保存的摘要" },
  ])("does not apply stale output after $field changes during generation", async ({ field, value }) => {
    const started = deferred<void>();
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => { started.resolve(); return response.promise; }));
    const running = runPostSummaryJob("old-job", modelId);
    await started.promise;
    db.post[field] = value;
    response.resolve(completion());
    await running;

    const snapshot = await getPostSummaryJobSnapshot("old-job");
    expect(snapshot.posts[0]).toMatchObject({
      excerpt: field === "excerpt" ? value : "原始摘要",
      [field]: value, summaryStatus: "FAILED",
    });
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
    expect(db.revalidate).not.toHaveBeenCalled();
  });

  test.each([
    { name: "new job", changes: { summaryJobId: "new-job", summaryStatus: "QUEUED", summaryModelId: "new-model" } },
    { name: "manual excerpt", changes: { excerpt: "手工摘要", summaryStatus: "GENERATED", summaryError: null } },
  ])("does not replace $name with a late upstream failure", async ({ changes }) => {
    const started = deferred<void>();
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => { started.resolve(); return response.promise; }));
    const running = runPostSummaryJob("old-job", modelId);
    await started.promise;
    Object.assign(db.post, changes);
    response.resolve(Response.json({ error: "Upstream failed" }, { status: 503 }));
    await running;

    const snapshot = await getPostSummaryJobSnapshot(String(db.post.summaryJobId));
    expect(snapshot.posts[0]).toMatchObject(changes);
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
  });

  test("preserves a manually saved excerpt when an upstream success arrives late", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      Object.assign(db.post, { excerpt: "手工摘要", summaryStatus: "GENERATED" });
      return completion();
    }));
    await runPostSummaryJob("old-job", modelId);

    expect((await getPostSummaryJobSnapshot("old-job")).posts[0]).toMatchObject({ excerpt: "手工摘要", summaryStatus: "GENERATED" });
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
  });

  test("does not call the model when ownership changes before the claim", async () => {
    db.findPosts.mockImplementationOnce(async () => {
      const snapshot = { ...db.post };
      Object.assign(db.post, { summaryJobId: "new-job", summaryModelId: "new-model" });
      return [snapshot];
    });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await runPostSummaryJob("old-job", modelId);

    expect(fetch).not.toHaveBeenCalled();
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
    expect((await getPostSummaryJobSnapshot("new-job")).posts[0]).toMatchObject({ summaryStatus: "QUEUED", summaryModelId: "new-model" });
  });

  test("finishes superseded task items when they no longer own any posts", async () => {
    db.post.summaryJobId = "new-job";
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await runPostSummaryJob("old-job", modelId);

    expect(fetch).not.toHaveBeenCalled();
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
  });

  test("skips superseded items even if their old model was removed", async () => {
    db.post.summaryJobId = "new-job";
    await runPostSummaryJob("old-job", "deleted-model");

    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
  });

  test("skips an item superseded while resolving an unavailable model", async () => {
    db.findModel.mockImplementationOnce(async () => {
      db.post.summaryJobId = "new-job";
      return null;
    });
    await runPostSummaryJob("old-job", "deleted-model");

    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
  });

  test("discards output for a post deleted during generation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      db.post.deletedAt = new Date();
      return completion();
    }));
    await runPostSummaryJob("old-job", modelId);

    expect((await getPostSummaryJobSnapshot("old-job")).posts).toHaveLength(0);
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SKIPPED", applied: false });
    expect(db.revalidate).not.toHaveBeenCalled();
  });

  test("records ordinary failures for an unchanged owned post", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Upstream failed" }, { status: 503 })));
    await runPostSummaryJob("old-job", modelId);

    expect((await getPostSummaryJobSnapshot("old-job")).posts[0]).toMatchObject({ excerpt: "原始摘要", summaryStatus: "FAILED", summaryError: "Upstream failed" });
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "FAILED", applied: false });
  });

  test("applies a current result and reports it as applied", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completion()));
    await runPostSummaryJob("old-job", modelId);

    expect((await getPostSummaryJobSnapshot("old-job")).posts[0]).toMatchObject({ excerpt: "旧任务生成的摘要", summaryStatus: "GENERATED" });
    expect((await getAiTaskDetail("old-job")).items[0]).toMatchObject({ status: "SUCCEEDED", applied: true });
    expect(db.revalidate).toHaveBeenCalledWith("/posts/post-one");
  });
});
