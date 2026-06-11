type ViewTransitionTarget = "cover" | "title";

function toSafeSlug(slug: string) {
  return slug
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getPostViewTransitionName(target: ViewTransitionTarget, slug: string) {
  return `post-${target}-${toSafeSlug(slug) || "unknown"}`;
}

export function getSeriesViewTransitionName(target: ViewTransitionTarget, slug: string) {
  return `series-${target}-${toSafeSlug(slug) || "unknown"}`;
}
