import Link from "next/link";
import { Clock3, FileText, Tags } from "lucide-react";

interface HomeRailPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  createdAt: Date | string;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ name: string; slug: string }>;
}

interface HomeRailTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  _count: { posts: number };
}

interface HomeDiscoveryGridProps {
  leadPost?: HomeRailPost | null;
  latestPosts: HomeRailPost[];
  tags: HomeRailTag[];
}

function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function getTocItems(post?: HomeRailPost | null) {
  const tagItems = post?.tags?.slice(0, 3).map((tag) => `${tag.name} 相关笔记`) ?? [];

  return [
    post?.category?.name ? `${post.category.name}导读` : "精选主题导读",
    "背景与问题",
    "方案拆解",
    ...tagItems,
    "延伸阅读",
  ].slice(0, 5);
}

export function HomeDiscoveryGrid({ leadPost, latestPosts, tags }: HomeDiscoveryGridProps) {
  const tocItems = getTocItems(leadPost);
  const recentPosts = latestPosts.slice(0, 5);
  const topTags = tags.slice(0, 12);

  return (
    <aside className="reader-section xl:sticky xl:top-[calc(var(--reader-nav-height)+var(--reader-nav-offset)+1rem)]" aria-label="阅读辅助">
      <section className="reader-panel p-5" aria-labelledby="home-toc-preview-title">
        <h2 id="home-toc-preview-title" className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
          <FileText className="h-5 w-5 text-[var(--text-body)]" aria-hidden="true" />
          目录预览
        </h2>

        <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-px before:bg-[color:color-mix(in_oklab,var(--accent-sky)_28%,var(--reader-border))]">
          {tocItems.map((item, index) => (
            <li key={`${item}-${index}`} className="relative grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-4 text-sm leading-5 text-[var(--text-body)]">
              <span className="relative z-10 mt-1.5 h-2 w-2 justify-self-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-sky)_54%,var(--reader-border))] bg-[var(--accent-sky)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-sky)_10%,transparent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="reader-panel p-5" aria-labelledby="home-recent-title">
        <h2 id="home-recent-title" className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
          <Clock3 className="h-5 w-5 text-[var(--text-body)]" aria-hidden="true" />
          最近更新
        </h2>

        {recentPosts.length > 0 ? (
          <div className="space-y-3">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                href={`/posts/${post.slug}`}
                className="group grid min-w-0 grid-cols-[0.5rem_minmax(0,1fr)_3.25rem] items-center gap-3 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-sky)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-sky)_10%,transparent)]" />
                <span className="truncate text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">{post.title}</span>
                <span className="justify-self-end text-xs text-[var(--text-muted)]">{formatShortDate(post.createdAt)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--reader-border)] p-3 text-sm leading-6 text-[var(--text-body)]">
            暂无最近更新。
          </p>
        )}
      </section>

      <section className="reader-panel p-5" aria-labelledby="home-hot-tags-title">
        <h2 id="home-hot-tags-title" className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--foreground)]">
          <Tags className="h-5 w-5 text-[var(--text-body)]" aria-hidden="true" />
          热门标签
        </h2>

        {topTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topTags.map((tag, index) => (
              <Link
                key={tag.id}
                href={`/tags/${tag.slug}`}
                className="reader-chip px-2.5 py-1 text-[0.72rem]"
                style={
                  tag.color
                    ? { borderColor: tag.color }
                    : {
                        borderColor:
                          index % 3 === 0
                            ? "color-mix(in oklab, var(--accent-sky) 34%, var(--reader-border))"
                            : index % 3 === 1
                              ? "color-mix(in oklab, var(--accent-warm) 34%, var(--reader-border))"
                              : "color-mix(in oklab, var(--accent-cyan) 34%, var(--reader-border))",
                      }
                }
              >
                {tag.name}
                <span className="text-[var(--text-faint)]">{tag._count.posts}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--reader-border)] p-3 text-sm leading-6 text-[var(--text-body)]">
            标签还在整理中。
          </p>
        )}
      </section>
    </aside>
  );
}
