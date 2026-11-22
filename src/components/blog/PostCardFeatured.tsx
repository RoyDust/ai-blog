import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { FallbackImage } from "@/components/ui";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";
import { PostMeta } from "./PostMeta";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

interface PostCardFeaturedProps {
  post: {
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    createdAt: Date | string;
    category?: {
      name: string;
      slug: string;
    } | null;
    tags?: Array<{
      name: string;
      slug: string;
    }>;
  };
  enableViewTransition?: boolean;
  priority?: boolean;
  prefetch?: boolean;
}

export function PostCardFeatured({
  post,
  enableViewTransition = false,
  priority = false,
  prefetch = false,
}: PostCardFeaturedProps) {
  return (
    <article className="reader-feature-card group">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)] lg:items-stretch">
        <div className="flex min-w-0 flex-col justify-between gap-4 p-5 sm:p-6">
          <div className="space-y-3">
            <span className="reader-chip w-fit rounded-md border-accent-warm-34 bg-accent-warm-14 text-accent-warm-78">
              精选文章
            </span>
            <div className="space-y-2">
              <Link href={`/posts/${post.slug}`} prefetch={prefetch}>
                <h2
                  className="text-90 line-clamp-2 text-xl font-bold leading-snug transition-colors group-hover:text-[var(--brand)] sm:text-2xl"
                  style={
                    enableViewTransition
                      ? { viewTransitionName: getPostViewTransitionName("title", post.slug) }
                      : undefined
                  }
                >
                  {post.title}
                </h2>
              </Link>
              {post.excerpt ? <p className="text-75 line-clamp-2 text-sm leading-relaxed">{post.excerpt}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <PostMeta
              category={post.category}
              hideTagsForMobile
              publishedAt={post.createdAt}
              tags={post.tags?.slice(0, 2)}
              variant="reader"
            />
            <Link
              href={`/posts/${post.slug}`}
              prefetch={false}
              className="home-primary-cta"
            >
              继续阅读
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <Link
          href={`/posts/${post.slug}`}
          prefetch={false}
          aria-label={`阅读封面：${post.title}`}
          className="theme-media relative mx-3 mb-3 min-h-[11.5rem] overflow-hidden rounded-xl lg:m-3 lg:ml-0 lg:min-h-[13rem]"
          style={
            enableViewTransition
              ? { viewTransitionName: getPostViewTransitionName("cover", post.slug) }
              : undefined
          }
        >
          {post.coverImage ? (
            <FallbackImage
              alt={post.title}
              blurDataURL={shimmerBlurDataURL}
              className="theme-media-image object-cover"
              fallbackSrc={READER_CARD_FALLBACK_SRC}
              fill
              loading={priority ? undefined : "lazy"}
              placeholder="blur"
              priority={priority}
              quality={70}
              sizes="(max-width: 1024px) 100vw, 24rem"
              src={post.coverImage}
            />
          ) : (
            <div className="absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden bg-[var(--reader-panel-muted)] p-5">
              <BookOpen
                aria-hidden="true"
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[var(--text-faint)] opacity-15"
                size={88}
                strokeWidth={1}
              />
              <span className="h-1 w-6 rounded-full bg-[var(--brand)]" />
              <p className="relative line-clamp-2 text-base font-bold leading-snug text-[var(--foreground)] opacity-80">
                {post.title}
              </p>
            </div>
          )}
        </Link>
      </div>
    </article>
  );
}
