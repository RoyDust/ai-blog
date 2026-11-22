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
    <nav aria-label={`${series.title} 系列导航`} className="reader-panel space-y-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/series/${series.slug}`} className="reader-link inline-flex items-center gap-2 text-sm font-bold">
          <ListTree className="h-4 w-4" />
          {series.title}
        </Link>
        <span className="rounded-md bg-[var(--btn-regular-bg)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[var(--btn-content)]">
          {Math.max(currentIndex + 1, 1)} / {posts.length}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--line-color)]" aria-hidden="true">
        <div
          className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-300"
          data-testid="series-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="space-y-1">
        {posts.map((post, index) => {
          const isCurrent = post.slug === currentSlug;
          return (
            <li key={post.slug}>
              <Link
                href={`/posts/${post.slug}`}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "flex min-w-0 items-center gap-2.5 rounded-lg bg-[var(--btn-regular-bg)] px-3 py-2 text-sm font-semibold text-[var(--btn-content)]"
                    : "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--text-body)] transition-colors hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)]"
                }
              >
                <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                  {String(post.seriesOrder || index + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{post.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {(previous || next) ? (
        <div className="grid gap-2.5 border-t border-dashed border-[var(--line-color)] pt-3.5 sm:grid-cols-2">
          {previous ? (
            <Link href={`/posts/${previous.slug}`} className="reader-link inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/posts/${next.slug}`} className="reader-link inline-flex min-w-0 items-center justify-end gap-1.5 text-xs font-semibold">
              <span className="truncate">{next.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
