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
            ? "grid min-h-[22rem] md:grid-cols-[minmax(0,1.04fr)_minmax(17rem,0.96fr)]"
            : "grid min-h-[16rem]"
        }
      >
        <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
          <div className="max-w-[34rem] space-y-5">
            <h1
              id="home-editorial-title"
              className="font-display text-balance text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--foreground)]"
            >
              {siteName}
            </h1>

            {siteDescription ? (
              <p className="line-clamp-3 max-w-[52ch] text-sm leading-7 text-[var(--text-body)] sm:text-base">
                {siteDescription}
              </p>
            ) : null}

            {post ? (
              <p className="line-clamp-2 text-lg font-medium leading-snug text-[var(--foreground)] sm:text-xl">
                {post.title}
              </p>
            ) : null}

            {post ? (
              <Link className="home-primary-cta" href={`/posts/${post.slug}`}>
                阅读精选
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-[var(--accent-sky)]" />
              </Link>
            ) : null}
          </div>
        </div>

        {post ? (
          <div
            className="theme-media relative min-h-48 overflow-hidden border-t border-[var(--reader-border)] md:min-h-full md:border-t-0 md:border-l"
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
              sizes="(max-width: 767px) 100vw, (min-width: 1800px) 32rem, 42vw"
              src={post.coverImage ?? READER_CARD_FALLBACK_SRC}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
