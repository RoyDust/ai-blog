import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";
import Link from "next/link";

interface SeriesNavPost {
  title: string;
  slug: string;
  seriesOrder: number;
}

interface SeriesNavProps {
  series: {
    title: string;
    slug: string;
  };
  currentSlug: string;
  posts: SeriesNavPost[];
}

export function SeriesNav({ series, currentSlug, posts }: SeriesNavProps) {
  const currentIndex = posts.findIndex((post) => post.slug === currentSlug);
  const previous = currentIndex > 0 ? posts[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;

  if (posts.length === 0) {
    return null;
  }

  const progressPercent = Math.round((Math.max(currentIndex + 1, 1) / posts.length) * 100);

  return (
    <nav aria-label={`${series.title} 系列导航`} className="reader-panel space-y-4 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/series/${series.slug}`} className="reader-link inline-flex items-center gap-2 text-sm font-semibold">
          <ListTree className="h-4 w-4" />
          {series.title}
        </Link>
        <span className="text-50 text-xs">
          {Math.max(currentIndex + 1, 1)} / {posts.length}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--reader-border)]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-[var(--accent-warm)] transition-[width] duration-300"
          data-testid="series-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="space-y-2">
        {posts.map((post, index) => {
          const isCurrent = post.slug === currentSlug;
          return (
            <li key={post.slug}>
              <Link
                href={`/posts/${post.slug}`}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "flex min-w-0 items-center gap-3 rounded-xl border border-[var(--accent-warm)] bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
                    : "flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--reader-border)] hover:text-[var(--foreground)]"
                }
              >
                <span className="text-50 w-6 shrink-0 tabular-nums">{String(post.seriesOrder || index + 1).padStart(2, "0")}</span>
                <span className="truncate">{post.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {(previous || next) ? (
        <div className="grid gap-3 border-t border-dashed border-[var(--reader-border)] pt-4 sm:grid-cols-2">
          {previous ? (
            <Link href={`/posts/${previous.slug}`} className="reader-link inline-flex min-w-0 items-center gap-2 text-sm font-medium">
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/posts/${next.slug}`} className="reader-link inline-flex min-w-0 items-center justify-end gap-2 text-sm font-medium">
              <span className="truncate">{next.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
