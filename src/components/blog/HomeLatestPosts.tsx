import Link from "next/link";
import { ArrowRight, ChevronRight, Clock3 } from "lucide-react";

import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";
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
        <h2 id="home-latest-title" className="reader-section-heading text-[0.9375rem]">
          最新文章
        </h2>

        <div className="reader-panel p-5">
          <div className="flex flex-col gap-2.5 text-sm leading-6 text-[var(--text-body)]">
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--btn-regular-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--btn-content)]">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
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
      <div className="flex items-center justify-between gap-4 px-0.5">
        <h2 id="home-latest-title" className="reader-section-heading text-[0.9375rem]">
          最新文章
        </h2>
        <Link
          href="/posts"
          className="reader-link inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--btn-regular-bg)]"
        >
          查看全部文章
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="home-latest-posts-stage space-y-3">
        {posts.map((post) => {
          const hasCover = Boolean(post.coverImage);

          return (
            <article
              className={cn(
                "reader-feed-card group grid min-w-0 grid-cols-1 md:items-stretch",
                hasCover
                  ? "md:grid-cols-[minmax(0,1fr)_13rem]"
                  : "md:grid-cols-[minmax(0,1fr)_3rem]",
              )}
              key={post.id}
            >
              <div className="flex min-w-0 flex-col justify-between gap-2.5 p-4 sm:px-5 sm:py-4">
                <div className="space-y-1.5">
                  <Link className="block min-w-0" href={`/posts/${post.slug}`}>
                    <h3
                      className="text-90 line-clamp-2 text-[1.0625rem] font-bold leading-snug transition-colors group-hover:text-[var(--brand)] sm:text-[1.125rem]"
                      style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}
                    >
                      {post.title}
                    </h3>
                  </Link>

                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--text-muted)]">
                    <span className="font-mono tabular-nums">
                      {new Date(post.createdAt).toLocaleDateString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </span>
                    {post.category ? (
                      <Link
                        className="reader-chip rounded-md px-2 py-0.5 text-[0.7rem]"
                        href={`/categories/${post.category.slug}`}
                      >
                        {post.category.name}
                      </Link>
                    ) : null}
                    {post.tags.length > 0 ? (
                      <span className="hidden items-center gap-1 text-[0.72rem] text-[var(--text-muted)] sm:inline-flex">
                        {post.tags.slice(0, 2).map((tag, tagIndex) => (
                          <span key={tag.slug} className="inline-flex items-center gap-1">
                            {tagIndex > 0 ? (
                              <span aria-hidden="true" className="text-[var(--text-faint)]">
                                /
                              </span>
                            ) : null}
                            <span>#{tag.name}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </div>

                  {post.excerpt ? (
                    <p className="text-75 line-clamp-2 text-[0.84375rem] leading-relaxed">{post.excerpt}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tabular-nums text-[var(--text-faint)]">
                  <span>{post.readingTimeMinutes ?? 10} 分钟</span>
                  {(post.viewCount ?? 0) > 0 ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{post.viewCount} 浏览</span>
                    </>
                  ) : null}
                </div>
              </div>

              {hasCover ? (
                <Link
                  aria-label={`阅读 ${post.title}`}
                  className="theme-media relative mx-3 mb-3 h-36 overflow-hidden rounded-xl md:m-2.5 md:ml-0 md:h-auto md:min-h-[8.5rem]"
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
                    sizes="(max-width: 767px) 100vw, 13rem"
                    src={post.coverImage!}
                  />
                </Link>
              ) : (
                <Link
                  aria-label={`阅读 ${post.title}`}
                  className="reader-card-action m-2.5 ml-0 hidden w-auto self-stretch md:inline-flex"
                  href={`/posts/${post.slug}`}
                >
                  <ChevronRight aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
