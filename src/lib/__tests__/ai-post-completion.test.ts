import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const db = vi.hoisted(() => {
  const state = { task: {} as Record<string, unknown>, item: {} as Record<string, unknown>, post: {} as Record<string, unknown>, fail: "", notifications: 0, recipients: 0 };
  const tx = {
    $queryRawUnsafe: vi.fn(),
    aiTask: { findUnique: vi.fn(async () => state.task), updateMany: vi.fn(async ({ data }) => { if (state.fail === "aggregate") throw new Error("aggregate unavailable"); Object.assign(state.task, data); return { count: 1 }; }), update: vi.fn(async ({ data }) => { Object.assign(state.task, data); return state.task; }) },
    aiTaskItem: { findUnique: vi.fn(async () => state.item), findMany: vi.fn(async () => [state.item]), updateMany: vi.fn(async ({ data }) => { Object.assign(state.item, data); return { count: 1 }; }) },
    post: { findFirst: vi.fn(async () => state.post.deletedAt ? null : state.post), updateMany: vi.fn(async ({ data }) => { Object.assign(state.post, data); return { count: 1 }; }), update: vi.fn(async ({ data }) => { Object.assign(state.post, data); return state.post; }) },
    user: { findMany: vi.fn(async () => [{ id: "admin-1" }]) },
    notification: { findUnique: vi.fn(async () => null), create: vi.fn(async () => { if (state.fail === "notification") throw new Error("notification unavailable"); state.notifications++; return { id: "notification-1" }; }) },
    notificationRecipient: { createMany: vi.fn(async () => { if (state.fail === "recipient") throw new Error("recipient unavailable"); state.recipients++; return { count: 1 }; }) },
    tag: { findMany: vi.fn(async () => []) }, category: { findFirst: vi.fn(async () => null) }, coverAsset: { findFirst: vi.fn(async () => null) },
  };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => { const before = structuredClone(state); try { return await fn(tx); } catch (error) { Object.assign(state, before); throw error; } }) };
  return { state, tx, prisma, revalidate: vi.fn((): { paths: string[]; errors: Array<{ path: string; error: string }> } => ({ paths: ["/posts/original"], errors: [] })) };
});
vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/cache", async (original) => ({
  ...await original<typeof import("@/lib/cache")>(),
  revalidatePublicContentStrict: db.revalidate,
}));
vi.mock("@/lib/ai-cover-image", () => ({ generateAiCoverImage: vi.fn() }));
vi.mock("@/lib/ai-models", () => ({ getAiModelForCapability: vi.fn(), getAiModelChatRequestExtras: vi.fn() }));
vi.mock("@/lib/post-summary", () => ({ generatePostSummary: vi.fn(), getPostSummaryMaxInputChars: () => 1000 }));

async function prepare(action = "seo-description") {
  const actions = await import("../ai-post-actions");
  const post = { id: "post-1", title: "Original", slug: "original", content: "body", excerpt: null, seoDescription: null, category: null, tags: [], published: true, authorId: "author-1", coverImage: null, series: null };
  const snapshot = actions.buildPostAiInputSnapshot(post, action as never);
  Object.assign(db.state, { task: { id: "task-1", status: "RUNNING", modelId: null }, item: { id: "item-1", taskId: "task-1", postId: "post-1", status: "RUNNING", action, inputSnapshot: snapshot, applied: false }, post: { ...post }, fail: "", notifications: 0, recipients: 0 });
  return { actions, input: { taskId: "task-1", itemId: "item-1", post, action: action as "seo-description", expectedInputSnapshot: snapshot, output: { seoDescription: "generated" }, modelId: "model-1", apply: true } };
}

async function prepareApplication(mode: "automatic" | "manual") {
  const { actions, input } = await prepare();
  if (mode === "manual") {
    Object.assign(db.state.task, { status: "SUCCEEDED", succeededCount: 1, failedCount: 0, modelId: input.modelId });
    Object.assign(db.state.item, { status: "SUCCEEDED", output: input.output });
  }
  return () => mode === "automatic"
    ? actions.completePostAiTaskItem(input)
    : actions.applyPostAiTaskItem(input.itemId);
}

describe("AI generated result commit", () => {
  beforeEach(() => { vi.clearAllMocks(); db.revalidate.mockReturnValue({ paths: ["/posts/original"], errors: [] }); });
  afterEach(() => { vi.restoreAllMocks(); });
  test("commits the post, item, counts, first notification and recipients together", async () => {
    const { actions, input } = await prepare();
    await actions.completePostAiTaskItem(input);
    expect(db.state.post.seoDescription).toBe("generated");
    expect(db.state.item).toMatchObject({ status: "SUCCEEDED", applied: true, output: { seoDescription: "generated" }, finishedAt: expect.any(Date) });
    expect(db.state.task).toMatchObject({ status: "SUCCEEDED", succeededCount: 1, failedCount: 0 });
    expect([db.state.notifications, db.state.recipients]).toEqual([1, 1]);
    expect(db.revalidate).toHaveBeenCalledTimes(1);
  });

  describe.each(["automatic", "manual"] as const)("%s application cache failures", (mode) => {
    test.each(["partial", "exception"] as const)("logs task identity and affected paths for %s failures without undoing success", async (failure) => {
      const apply = await prepareApplication(mode);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const paths = ["/", "/posts", "/archives", "/series", "/posts/original"];
      const error = new Error("cache unavailable");
      const errors = [{ path: failure === "partial" ? "/posts/original" : "*", error: error.message }];
      if (failure === "partial") {
        db.revalidate.mockReturnValueOnce({ paths, errors });
      } else {
        db.revalidate.mockImplementationOnce(() => { throw error; });
      }

      const result = await apply();

      expect(log).toHaveBeenCalledExactlyOnceWith(
        failure === "partial" ? "AI content cache refresh incomplete:" : "AI content cache refresh failed:",
        expect.objectContaining({ taskId: "task-1", itemId: "item-1", postId: "post-1", paths, errors }),
      );
      if (failure === "exception") expect(log.mock.calls[0][1]).toHaveProperty("error", error);
      expect(result).toMatchObject(mode === "automatic"
        ? { status: "SUCCEEDED", applied: true, cache: { paths, errors } }
        : { id: "post-1", seoDescription: "generated" });
      expect(db.state.post.seoDescription).toBe("generated");
      expect(db.state.item).toMatchObject({ status: "SUCCEEDED", applied: true });
      expect(db.state.task).toMatchObject({ status: "SUCCEEDED", succeededCount: 1, failedCount: 0 });

      await apply();
      expect(db.revalidate).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(db.tx.post.updateMany).toHaveBeenCalledTimes(1);
      expect(db.tx.aiTaskItem.updateMany).toHaveBeenCalledTimes(1);
      expect([db.state.notifications, db.state.recipients]).toEqual(mode === "automatic" ? [1, 1] : [0, 0]);
    });
  });
});
