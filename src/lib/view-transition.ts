type PostViewTransitionTarget = "cover" | "title";

export function getPostViewTransitionName(target: PostViewTransitionTarget, slug: string) {
  const safeSlug = slug
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `post-${target}-${safeSlug || "unknown"}`;
}
