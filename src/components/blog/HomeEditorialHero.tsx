import Link from "next/link";

import { MetaLine, Seal, TextLink } from "@/components/editorial";
import { BrandMark } from "@/components/layout/BrandMark";
import { FallbackImage } from "@/components/ui";
import { formatIsoDate, formatWeekday } from "@/lib/editorial-format";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

interface HomeEditorialHeroProps {
  siteName: string;
  siteDescription: string;
  /** 报头日期；默认取渲染时刻（首页 ISR 300s，足够准确） */
  today?: Date;
  post?: {
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    featured?: boolean;
    createdAt?: string | Date;
    readingTimeMinutes?: number | null;
    category?: { name: string; slug: string } | null;
  } | null;
}

/**
 * 首页报头 + 精选（简报 15.9 第 1–2 条、17.2）。
 *
 * 报头：logo 方块 + 衬线站名与等宽日期同行 + 描述第二行，2px 报头线。
 * 精选：左文右图（md 以上等高），印章「精选」只在精选文章上出现；手机上下排、封面整宽 12rem。
 */
export function HomeEditorialHero({ siteName, siteDescription, post, today = new Date() }: HomeEditorialHeroProps) {
  const href = post ? `/posts/${post.slug}` : null;

  return (
    <section aria-labelledby="home-editorial-title" className="home-editorial-hero" data-testid="home-editorial-hero">
      <header className="home-masthead-enter flex items-center gap-3 pb-5 sm:gap-4">
        <BrandMark className="sm:hidden" siteName={siteName} size={36} />
        <BrandMark className="hidden sm:inline-flex" siteName={siteName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h1
              id="home-editorial-title"
              className="ed-serif min-w-0 truncate text-[1.375rem] leading-[1.15] text-[var(--foreground)] sm:text-[1.75rem]"
            >
              {siteName}
            </h1>
            <p className="ed-mono shrink-0 text-[0.75rem] text-[var(--text-muted)] sm:text-[0.8125rem]">
              <time dateTime={formatIsoDate(today)}>{formatIsoDate(today)}</time>
              <span className="ml-2 hidden min-[420px]:inline">{formatWeekday(today)}</span>
            </p>
          </div>
          {siteDescription ? (
            <p className="mt-1 truncate text-[0.875rem] text-[var(--text-muted)]">{siteDescription}</p>
          ) : null}
        </div>
      </header>
      <hr className="ed-rule-strong home-rule-draw" />

      {post && href ? (
        <article className="home-featured-enter ed-media-hover grid gap-5 border-b border-[var(--border)] py-6 md:grid-cols-[minmax(0,1fr)_minmax(14rem,17.5rem)] md:gap-8 md:py-7">
          <div className="flex min-w-0 flex-col">
            <p className="flex items-center gap-2.5">
              {post.featured ? <Seal>精选</Seal> : null}
              {post.category ? (
                <Link className="ed-tag text-[0.8125rem]" href={`/categories/${post.category.slug}`}>
                  {post.category.name}
                </Link>
              ) : null}
            </p>
            <h2
              className="ed-serif mt-3 line-clamp-2 text-balance text-[clamp(1.5rem,2.8vw,2.125rem)] leading-[1.25] text-[var(--foreground)]"
              style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}
            >
              <Link className="underline decoration-transparent decoration-1 underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-[var(--reader-border-strong)]" href={href}>
                {post.title}
              </Link>
            </h2>
            {post.excerpt ? (
              <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">{post.excerpt}</p>
            ) : null}
            <MetaLine
              className="mt-3"
              items={[
                post.createdAt ? <span className="ed-mono">{formatIsoDate(post.createdAt)}</span> : null,
                post.readingTimeMinutes ? <span className="ed-mono">{post.readingTimeMinutes} 分钟</span> : null,
              ]}
            />
            <div className="mt-auto pt-5 max-md:order-last">
              <TextLink href={href} aria-label={`阅读全文：${post.title}`}>
                阅读全文
              </TextLink>
            </div>
          </div>

          {post.coverImage ? (
            <Link
              aria-hidden="true"
              tabIndex={-1}
              href={href}
              className="ed-media block h-48 md:aspect-[4/3] md:h-auto md:self-start"
              style={{ viewTransitionName: getPostViewTransitionName("cover", post.slug) }}
            >
              <FallbackImage
                alt=""
                blurDataURL={shimmerBlurDataURL}
                className="object-cover"
                fallbackSrc={READER_CARD_FALLBACK_SRC}
                fill
                placeholder="blur"
                priority
                quality={75}
                sizes="(max-width: 767px) 100vw, 17.5rem"
                src={post.coverImage}
              />
            </Link>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
