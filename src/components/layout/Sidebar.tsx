import Link from "next/link";

export interface SidebarProps {
  categories?: Array<{ name: string; slug: string; count: number }>;
  recentPosts?: Array<{ title: string; slug: string }>;
}

export function Sidebar({ categories = [], recentPosts = [] }: SidebarProps) {
  return (
    <aside className="space-y-6">
      {categories.length > 0 && (
        <div className="ui-surface rounded-2xl p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">
            分类导航
          </h3>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                >
                  <span>{category.name}</span>
                  <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs">
                    {category.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentPosts.length > 0 && (
        <div className="ui-surface rounded-2xl p-5">
          <h3 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">
            最新文章
          </h3>
          <ul className="space-y-3">
            {recentPosts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/posts/${post.slug}`}
                  className="line-clamp-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--brand)]"
                >
                  {post.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ui-surface rounded-2xl p-5">
        <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">
          创作者周报
        </h3>
        <p className="mb-4 text-sm text-[var(--muted)]">
          订阅内容更新、编辑策略和运营建议。
        </p>
        <form className="space-y-2" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="输入邮箱"
            className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
          <button
            type="submit"
            className="ui-btn w-full bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-strong)]"
          >
            订阅
          </button>
        </form>
      </div>
    </aside>
  );
}
