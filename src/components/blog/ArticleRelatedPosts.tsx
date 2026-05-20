import Link from "next/link";
import { SectionHeader } from "./SectionHeader";

type RelatedPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  createdAt: string | Date;
  category?: {
    name: string;
    slug: string;
  } | null;
};

interface ArticleRelatedPostsProps {
  posts: RelatedPost[];
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});

export function ArticleRelatedPosts({ posts }: ArticleRelatedPostsProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section aria-label="相关文章" className="reader-panel w-full space-y-5 p-6 sm:p-8">
      <SectionHeader eyebrow="延伸阅读" title="相关文章" variant="compact" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.slug}`} className="reader-feed-card group flex h-full flex-col gap-3 p-4">
              {post.category ? <span className="reader-chip self-start">{post.category.name}</span> : null}
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)]">
                {post.title}
              </h3>
              {post.excerpt ? (
                <p className="line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{post.excerpt}</p>
              ) : null}
              <p className="mt-auto text-xs text-[var(--text-faint)]">{dateFormatter.format(new Date(post.createdAt))}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
