"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FallbackImage } from "@/components/ui";

interface HomeReaderBannerPost {
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  category?: { name: string; slug: string } | null;
  tags?: Array<{ name: string; slug: string }>;
  createdAt: Date | string;
  readingTimeMinutes?: number;
}

interface HomeReaderBannerProps {
  posts?: HomeReaderBannerPost[];
  leadPost?: HomeReaderBannerPost | null;
  latestPost?: HomeReaderBannerPost | null;
}

function formatDate(value?: Date | string | null) {
  if (!value) {
    return "持续更新";
  }

  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function HomeReaderBanner({ posts = [], leadPost, latestPost }: HomeReaderBannerProps) {
  const slides = useMemo(() => {
    const featuredSlides = posts.slice(0, 4);

    if (featuredSlides.length > 0) {
      return featuredSlides;
    }

    const fallbackPost = leadPost ?? latestPost;
    return fallbackPost ? [fallbackPost] : [];
  }, [leadPost, latestPost, posts]);

  const [activeIndex, setActiveIndex] = useState(0);
  const safeActiveIndex = slides.length > 0 ? Math.min(activeIndex, slides.length - 1) : 0;
  const displayPost = slides[safeActiveIndex] ?? null;

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  return (
    <section
      className="reader-feature-card p-3 lg:h-[17rem]"
      aria-labelledby="home-reader-title"
      aria-roledescription="carousel"
    >
      {displayPost ? (
        <div className="grid h-full min-h-0 gap-0 overflow-hidden rounded-[calc(var(--radius-large)+0.125rem)] lg:grid-cols-[minmax(14rem,0.38fr)_minmax(0,0.62fr)] lg:grid-rows-[minmax(0,1fr)_auto]">
          <Link
            href={`/posts/${displayPost.slug}`}
            aria-label={`阅读精选文章：${displayPost.title}`}
            className="theme-media relative min-h-[12.5rem] overflow-hidden rounded-[calc(var(--radius-large)-0.25rem)] lg:h-full lg:min-h-0"
          >
            {displayPost.coverImage ? (
              <FallbackImage
                alt={displayPost.title}
                className="theme-media-image object-cover"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 34rem"
                src={displayPost.coverImage}
              />
            ) : (
              <FallbackImage
                alt=""
                aria-hidden="true"
                className="theme-media-image object-cover"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 34rem"
                src="/images/night-reader-feature-fallback.svg"
              />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_10%,rgb(2_6_23_/_0.22)_58%,rgb(2_6_23_/_0.58))]" />
            <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
              <span className="reader-chip backdrop-blur-md">{displayPost.category?.name ?? "精选文章"}</span>
            </div>
          </Link>

          <div className="flex min-h-0 min-w-0 flex-col justify-between gap-3 p-5">
            <div className="space-y-3">
              <span className="reader-chip w-fit">{displayPost.category?.name ?? "工程实践"}</span>
              <Link href={`/posts/${displayPost.slug}`}>
                <h1 id="home-reader-title" className="line-clamp-2 max-w-3xl text-pretty font-display text-2xl font-bold leading-[1.15] text-[var(--foreground)] transition-colors hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] md:text-[1.7rem]">
                  {displayPost.title}
                </h1>
              </Link>
              {displayPost.excerpt ? (
                <p className="line-clamp-2 max-w-2xl text-sm leading-7 text-[var(--text-body)]">
                  {displayPost.excerpt}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {formatDate(displayPost.createdAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  {displayPost.readingTimeMinutes ?? 10} 分钟
                </span>
                {displayPost.tags?.slice(0, 2).map((tag) => (
                  <Link key={tag.slug} href={`/tags/${tag.slug}`} className="inline-flex items-center gap-1.5 text-[var(--text-muted)] transition hover:text-[var(--foreground)]">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    {tag.name}
                  </Link>
                ))}
              </div>

              <Link
                href={`/posts/${displayPost.slug}`}
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] px-5 py-3 text-sm font-bold text-[color:color-mix(in_oklab,var(--reader-bg)_22%,black_78%)] shadow-[0_18px_42px_color-mix(in_oklab,var(--accent-sky)_24%,transparent)] transition hover:translate-y-[-1px] hover:opacity-95 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--ring)_45%,transparent)]"
              >
                继续阅读
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="col-span-full flex justify-center gap-2 pt-2 pb-1">
            {slides.map((slide, index) => {
              const isActive = index === safeActiveIndex;

              return (
                <button
                  key={slide.slug}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`查看精选文章：${slide.title}`}
                  className={`h-1 rounded-full transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklab,var(--ring)_45%,transparent)] ${
                    isActive ? "w-7 bg-[var(--accent-sky)]" : "w-5 bg-[var(--reader-border-strong)] hover:bg-[var(--text-faint)]"
                  }`}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="min-h-[16rem] p-6 md:p-8">
          <div className="max-w-2xl space-y-4">
            <span className="reader-chip w-fit">精选文章</span>
            <div className="space-y-3">
              <h1 id="home-reader-title" className="max-w-2xl text-pretty font-display text-3xl font-bold leading-tight text-[var(--foreground)] md:text-5xl">
                夜读书架还在编选
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base md:leading-8">
                精选位正在整理中，先从最新文章继续阅读。
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
