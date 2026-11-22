import Link from "next/link";

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
    <section aria-label="相关文章" className="reader-panel w-full space-y-4 p-5 sm:p-6">
      <h2 className="reader-section-heading text-base">相关文章</h2>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.slug}`}
              className="group flex h-full flex-col gap-2 rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,transparent)] p-3.5 transition-colors hover:bg-[var(--btn-regular-bg)]"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                {post.category ? (
                  <span className="font-semibold text-[var(--brand)]">{post.category.name}</span>
                ) : (
                  <span>延伸阅读</span>
                )}
                <span className="font-mono tabular-nums text-[var(--text-faint)]">
                  {dateFormatter.format(new Date(post.createdAt))}
                </span>
              </div>
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)]">
                {post.title}
              </h3>
              {post.excerpt ? (
                <p className="line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{post.excerpt}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
