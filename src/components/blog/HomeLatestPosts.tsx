import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Eye } from "lucide-react";

import { FallbackImage } from "@/components/ui";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

interface HomeLatestPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  createdAt: Date | string;
  coverImage?: string | null;
  readingTimeMinutes?: number;
  viewCount?: number;
  author: { id: string; name: string | null; image: string | null };
  category: { id?: string; name: string; slug: string } | null;
  tags: Array<{ id?: string; name: string; slug: string }>;
  _count: { comments: number; likes: number };
}

interface HomeLatestPostsProps {
  posts: HomeLatestPost[];
}

export function HomeLatestPosts({ posts }: HomeLatestPostsProps) {
  if (posts.length === 0) {
    return (
      <section className="reader-section" aria-labelledby="home-latest-title">
        <h2 id="home-latest-title" className="reader-section-heading reader-section-heading--plain">
          最新文章
        </h2>

        <div className="reader-panel p-5 md:p-6">
          <div className="flex flex-col gap-3 text-sm leading-7 text-[var(--text-body)]">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--reader-border)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
              <Clock3 className="h-4 w-4 text-[var(--accent-sky)]" aria-hidden="true" />
              新文章筹备中
            </span>
            <p>最新文章区会保留当前位置，避免首页在空数据时突然塌陷。</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="reader-section" aria-labelledby="home-latest-title">
      <div className="flex items-center justify-between gap-4">
        <h2 id="home-latest-title" className="reader-section-heading reader-section-heading--plain">
          最新文章
        </h2>
        <Link
          href="/posts"
          className="reader-link inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[color:color-mix(in_oklab,var(--accent-sky)_66%,var(--foreground)_34%)]"
        >
          查看全部文章
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="home-latest-posts-stage border-t border-[var(--reader-border)]">
        {posts.map((post) => (
          <article
            className="home-compact-post group grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-b border-[var(--reader-border)] py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5 sm:py-5"
            key={post.id}
          >
            <Link
              aria-label={`阅读 ${post.title}`}
              className="theme-media relative h-24 overflow-hidden rounded-xl sm:h-28"
              href={`/posts/${post.slug}`}
              style={{ viewTransitionName: getPostViewTransitionName("cover", post.slug) }}
            >
              <FallbackImage
                alt={post.title}
                blurDataURL={shimmerBlurDataURL}
                className="theme-media-image object-cover"
                fallbackSrc={READER_CARD_FALLBACK_SRC}
                fill
                loading="lazy"
                placeholder="blur"
                quality={75}
                sizes="(max-width: 639px) 6.5rem, 8rem"
                src={post.coverImage ?? READER_CARD_FALLBACK_SRC}
              />
            </Link>

            <div className="min-w-0 self-center space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {post.category ? (
                  <Link
                    className="reader-chip rounded-md px-2 py-1 text-[0.68rem]"
                    href={`/categories/${post.category.slug}`}
                  >
                    {post.category.name}
                  </Link>
                ) : null}
              </div>

              <Link className="block min-w-0" href={`/posts/${post.slug}`}>
                <h3
                  className="line-clamp-2 text-base font-medium leading-snug text-[var(--foreground)] transition-colors group-hover:text-[var(--accent-sky)] sm:text-lg"
                  style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}
                >
                  {post.title}
                </h3>
              </Link>

              {post.excerpt ? (
                <p className="hidden line-clamp-1 text-sm leading-6 text-[var(--text-body)] md:block">{post.excerpt}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] tabular-nums text-[var(--text-faint)]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {new Date(post.createdAt).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {post.readingTimeMinutes ?? 10} 分钟
                </span>
                {(post.viewCount ?? 0) > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    {post.viewCount} 浏览
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
