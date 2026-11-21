import NextLink from "next/link";
import { Eye, Flame } from "lucide-react";

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
    <ol aria-hidden="true" className="space-y-3" data-testid="popular-posts-skeleton">
      {Array.from({ length: POPULAR_POST_LIMIT }).map((_, index) => (
        <li className="flex items-start gap-2.5" key={index}>
          <span className="mt-0.5 h-4 w-4 shrink-0 rounded-md reader-skeleton" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block h-3.5 w-full rounded-md reader-skeleton" />
            <span className="block h-3.5 w-4/5 rounded-md reader-skeleton" />
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
    <section aria-busy={isLoading} aria-labelledby="sidebar-popular-title" className="reader-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-[var(--accent-warm)]" />
        <Flame aria-hidden="true" className="h-4 w-4 text-[var(--text-body)]" />
        <h3 className="font-bold text-[var(--foreground)]" id="sidebar-popular-title">
          热门文章
        </h3>
      </div>
      {isLoading ? (
        <PopularPostsSkeleton />
      ) : (
        <ol className="space-y-2">
          {posts.slice(0, POPULAR_POST_LIMIT).map((post, index) => (
            <li className="flex items-start gap-2.5" key={post.id}>
              <span className="mt-0.5 w-4 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--text-faint)]">
                {index + 1}
              </span>
              <NextLink className="group flex min-w-0 flex-1 flex-col gap-1" href={`/posts/${post.slug}`}>
                <span className="line-clamp-2 text-sm leading-snug text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">
                  {post.title}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]">
                  <Eye aria-hidden="true" className="h-3 w-3" />
                  {post.viewCount.toLocaleString("zh-CN")}
                </span>
              </NextLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
