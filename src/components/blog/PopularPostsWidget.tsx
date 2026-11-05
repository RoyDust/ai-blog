import NextLink from "next/link";
import { SkeletonBar } from "@/components/editorial";
import { formatIndex } from "@/lib/editorial-format";

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
  /** 区块标题文字；侧栏写「热门」 */
  title?: string;
  className?: string;
}

function PopularPostsSkeleton() {
  return (
    <ol aria-hidden="true" className="space-y-3" data-testid="popular-posts-skeleton">
      {Array.from({ length: POPULAR_POST_LIMIT }).map((_, index) => (
        <li className="flex items-start gap-3" key={index}>
          <SkeletonBar className="mt-1 h-3 w-4" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBar className="h-3.5 w-full" />
            <SkeletonBar className="h-3.5 w-3/5" />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * 侧栏「热门」（简报 15.10）：衬线组标题，3 行等宽序号 01–03 加标题，最多 2 行。
 */
export function PopularPostsWidget({ posts, isLoading = false, title = "热门", className }: PopularPostsWidgetProps) {
  if (!isLoading && posts.length === 0) {
    return null;
  }

  return (
    <section aria-busy={isLoading} aria-labelledby="sidebar-popular-title" className={className}>
      <h3 className="ed-serif mb-3 text-base text-[var(--foreground)]" id="sidebar-popular-title">
        {title}
      </h3>
      {isLoading ? (
        <PopularPostsSkeleton />
      ) : (
        <ol className="space-y-1">
          {posts.slice(0, POPULAR_POST_LIMIT).map((post, index) => (
            <li key={post.id}>
              <NextLink
                className="group flex min-h-11 items-start gap-3 py-1.5 text-[0.875rem] leading-[1.5] text-[var(--text-body)] transition-colors hover:text-[var(--foreground)]"
                href={`/posts/${post.slug}`}
                title={`${post.viewCount.toLocaleString("zh-CN")} 次阅读`}
              >
                <span className="ed-mono pt-px text-[0.8125rem] text-[var(--text-muted)]">{formatIndex(index + 1)}</span>
                <span className="line-clamp-2 min-w-0 flex-1 underline decoration-transparent underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[var(--reader-border-strong)]">
                  {post.title}
                </span>
              </NextLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
