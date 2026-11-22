import NextLink from "next/link";
import { Eye } from "lucide-react";

const POPULAR_POST_LIMIT = 3;

export type PopularPost = {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
};

interface PopularPostsWidgetProps {
  posts: PopularPost[];
  isLoading?: boolean;
}

function PopularPostsSkeleton() {
  return (
    <ol aria-hidden="true" className="space-y-2.5" data-testid="popular-posts-skeleton">
      {Array.from({ length: POPULAR_POST_LIMIT }).map((_, index) => (
        <li className="flex items-start gap-2.5" key={index}>
          <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md reader-skeleton" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="block h-3.5 w-full rounded-md reader-skeleton" />
            <span className="block h-3 w-16 rounded-md reader-skeleton" />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PopularPostsWidget({ posts, isLoading = false }: PopularPostsWidgetProps) {
  if (!isLoading && posts.length === 0) {
    return null;
  }

  return (
    <section aria-busy={isLoading} aria-labelledby="sidebar-popular-title" className="reader-panel px-4 py-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span aria-hidden="true" className="h-3.5 w-[3.5px] shrink-0 rounded-full bg-[var(--brand)]" />
        <h3 className="text-sm font-bold text-[var(--foreground)]" id="sidebar-popular-title">
          热门文章
        </h3>
      </div>
      {isLoading ? (
        <PopularPostsSkeleton />
      ) : (
        <ol className="space-y-1">
          {posts.slice(0, POPULAR_POST_LIMIT).map((post, index) => (
            <li className="-mx-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--btn-regular-bg)]" key={post.id}>
              <NextLink className="group flex min-w-0 items-start gap-2.5" href={`/posts/${post.slug}`}>
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--btn-regular-bg)] font-mono text-[0.6875rem] font-bold tabular-nums text-[var(--btn-content)]">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[0.8125rem] leading-snug text-[var(--text-body)] transition-colors group-hover:text-[var(--btn-content)]">
                    {post.title}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] tabular-nums text-[var(--text-muted)]">
                    <Eye aria-hidden="true" className="h-3 w-3" />
                    {post.viewCount.toLocaleString("zh-CN")}
                  </span>
                </span>
              </NextLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
