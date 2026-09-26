import { NotFoundError } from "@/lib/api-errors";
import { getPublicContentPaths, revalidatePublicPathsStrict, type PublicContentPathsInput } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

type CachePost = {
  slug: string; published: boolean; deletedAt: Date | null;
  category: { slug: string } | null; tags: Array<{ slug: string }>; series: { slug: string } | null;
};
function currentPaths(post: CachePost | null): PublicContentPathsInput {
  if (!post || !post.published || post.deletedAt) return {};
  return { slug: post.slug, categorySlug: post.category?.slug, tagSlugs: post.tags.map((tag) => tag.slug), seriesSlug: post.series?.slug };
}
function previousPaths(value: unknown) {
  const snapshot = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const nullableSlug = (entry: unknown) => entry === null || typeof entry === "string";
  const fields = [
    typeof snapshot.published !== "boolean" ? "published" : null,
    typeof snapshot.slug !== "string" ? "slug" : null,
    !nullableSlug(snapshot.categorySlug) ? "categorySlug" : null,
    !Array.isArray(snapshot.tagSlugs) || !snapshot.tagSlugs.every((slug) => typeof slug === "string") ? "tagSlugs" : null,
    !nullableSlug(snapshot.seriesSlug) ? "seriesSlug" : null,
  ].filter((field): field is string => field !== null);
  const options: PublicContentPathsInput = snapshot.published === false ? {} : {
    previousSlug: typeof snapshot.slug === "string" ? snapshot.slug : null,
    previousCategorySlug: typeof snapshot.categorySlug === "string" ? snapshot.categorySlug : null,
    previousTagSlugs: Array.isArray(snapshot.tagSlugs) ? snapshot.tagSlugs.filter((slug): slug is string => typeof slug === "string") : [],
    previousSeriesSlug: typeof snapshot.seriesSlug === "string" ? snapshot.seriesSlug : null,
  };
  return { fields, options };
}

/** Request-context recovery only: never generate, apply, or advance task state. */
export async function revalidateAiTaskContent(taskId: string) {
  const task = await prisma.aiTask.findUnique({
    where: { id: taskId },
    select: { id: true, items: { where: { status: "SUCCEEDED", applied: true }, select: {
      id: true, inputSnapshot: true,
      post: { select: { slug: true, published: true, deletedAt: true, category: { select: { slug: true } }, tags: { where: { deletedAt: null }, select: { slug: true } }, series: { select: { slug: true } } } },
    } } },
  });
  if (!task) throw new NotFoundError("AI task not found");
  const paths = new Set<string>();
  const missingEvidence: Array<{ itemId: string; fields: string[] }> = [];
  for (const item of task.items) {
    const previous = previousPaths(item.inputSnapshot);
    if (previous.fields.length) missingEvidence.push({ itemId: item.id, fields: previous.fields });
    for (const path of getPublicContentPaths({ ...previous.options, ...currentPaths(item.post) })) paths.add(path);
  }
  const result = revalidatePublicPathsStrict([...paths]);
  return { taskId: task.id, complete: missingEvidence.length === 0 && result.errors.length === 0, ...result, missingEvidence };
}
