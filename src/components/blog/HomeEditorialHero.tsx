import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FallbackImage } from "@/components/ui";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

interface HomeEditorialHeroProps {
  siteName: string;
  siteDescription: string;
  post?: {
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
  } | null;
}

export function HomeEditorialHero({ siteName, siteDescription, post }: HomeEditorialHeroProps) {
  return (
    <section
      aria-labelledby="home-editorial-title"
      className="home-editorial-hero reader-feature-card"
      data-testid="home-editorial-hero"
    >
      <div
        className={
          post
            ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_14.5rem] md:items-stretch"
            : "grid grid-cols-1"
        }
      >
        <div className="flex min-w-0 flex-col justify-between gap-3.5 p-4 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--btn-regular-bg)] ring-1 ring-[var(--reader-border)] xl:h-9 xl:w-9">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  height={40}
                  src="/icons/icon-192.png"
                  width={40}
                />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1
                    id="home-editorial-title"
                    className="font-display truncate text-base font-bold leading-snug text-[var(--foreground)] sm:text-[1.0625rem]"
                  >
                    {siteName}
                  </h1>
                  <span aria-hidden="true" className="h-1 w-3.5 shrink-0 rounded-full bg-[var(--brand)]" />
                </div>
                {siteDescription ? (
                  <p className="line-clamp-1 text-xs leading-5 text-[var(--text-muted)]">
                    {siteDescription}
                  </p>
                ) : null}
              </div>
            </div>

            <Link
              href="/archives"
              className="reader-link hidden shrink-0 items-center gap-0.5 rounded-lg bg-[var(--btn-regular-bg)] px-2.5 py-1.5 text-xs font-semibold text-[var(--btn-content)] transition-colors hover:bg-[var(--btn-regular-bg-hover)] sm:inline-flex xl:hidden"
            >
              归档 ›
            </Link>
          </div>

          {post ? (
            <div className="space-y-2.5 border-t border-dashed border-[var(--line-color)] pt-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  置顶导读
                </span>
                <p
                  className="line-clamp-2 text-[1.0625rem] font-bold leading-snug text-[var(--foreground)] sm:text-[1.125rem]"
                  style={{ viewTransitionName: getPostViewTransitionName("title", post.slug) }}
                >
                  {post.title}
                </p>
                {post.excerpt ? (
                  <p className="line-clamp-1 text-[0.8125rem] leading-relaxed text-[var(--text-body)]">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                <Link className="home-primary-cta" href={`/posts/${post.slug}`}>
                  阅读精选
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {post ? (
          <div
            className="theme-media relative mx-3 mb-3 h-36 overflow-hidden rounded-xl md:m-2.5 md:ml-0 md:h-auto md:min-h-[9rem]"
            style={{ viewTransitionName: getPostViewTransitionName("cover", post.slug) }}
          >
            <FallbackImage
              alt={post.title}
              blurDataURL={shimmerBlurDataURL}
              className="theme-media-image object-cover"
              fallbackSrc={READER_CARD_FALLBACK_SRC}
              fill
              placeholder="blur"
              priority
              quality={75}
              sizes="(max-width: 767px) 100vw, 14.5rem"
              src={post.coverImage ?? READER_CARD_FALLBACK_SRC}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
