import NextLink from "next/link";
import { Eye, Flame } from "lucide-react";

export type PopularPost = {
  id: string;
  title: string;
  slug: string;
  viewCount: number;
};

interface PopularPostsWidgetProps {
  posts: PopularPost[];
}

export function PopularPostsWidget({ posts }: PopularPostsWidgetProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="sidebar-popular-title" className="reader-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-[var(--accent-warm)]" />
        <Flame aria-hidden="true" className="h-4 w-4 text-[var(--text-body)]" />
        <h3 className="font-bold text-[var(--foreground)]" id="sidebar-popular-title">
          热门文章
        </h3>
      </div>
      <ol className="space-y-2">
        {posts.map((post, index) => (
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
    </section>
  );
}
