import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { aiTask: { findUnique: mocks.find } } }));
vi.mock("@/lib/cache", async (original) => ({ ...await original<typeof import("@/lib/cache")>(), revalidatePublicPathsStrict: mocks.refresh }));
beforeEach(() => { vi.clearAllMocks(); mocks.refresh.mockImplementation((paths) => ({ paths, errors: [] })); });
test("revalidates old and current paths without changing business state", async () => {
  mocks.find.mockResolvedValue({ id: "task-1", items: [{ id: "item-1", inputSnapshot: { published: true, slug: "old", categorySlug: "old-cat", tagSlugs: ["old-tag"], seriesSlug: "old-series" }, post: { slug: "new", published: true, deletedAt: null, category: { slug: "new-cat" }, tags: [{ slug: "new-tag" }], series: { slug: "new-series" } } }] });
  const { revalidateAiTaskContent } = await import("../ai-task-cache-recovery");
  const result = await revalidateAiTaskContent("task-1");
  expect(result.complete).toBe(true);
  expect(result.paths).toEqual(expect.arrayContaining(["/posts/old", "/posts/new", "/categories/old-cat", "/categories/new-cat", "/tags/old-tag", "/tags/new-tag", "/series/old-series", "/series/new-series"]));
  expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task-1" } }));
});
test("reports incomplete historical evidence and individual cache failures", async () => {
  mocks.find.mockResolvedValue({ id: "task-1", items: [{ id: "legacy-1", inputSnapshot: { slug: "old" }, post: null }] });
  mocks.refresh.mockImplementation((paths) => ({ paths, errors: [{ path: "/posts/old", error: "static generation store missing" }] }));
  const { revalidateAiTaskContent } = await import("../ai-task-cache-recovery");
  const result = await revalidateAiTaskContent("task-1");
  expect(result.complete).toBe(false);
  expect(result.missingEvidence).toEqual([{ itemId: "legacy-1", fields: ["published", "categorySlug", "tagSlugs", "seriesSlug"] }]);
  expect(result.errors).toHaveLength(1);
});
