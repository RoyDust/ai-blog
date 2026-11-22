import { FallbackImage } from "@/components/ui";
import Link from "next/link";
import { ChevronRight, Eye, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { shimmerBlurDataURL } from "@/lib/image-placeholder";
import { getPostViewTransitionName } from "@/lib/view-transition";
import { PostMeta } from "./PostMeta";

const READER_CARD_FALLBACK_SRC = "/images/fuwari-post-cover-fallback.svg";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    featured?: boolean;
    createdAt: string | Date;
    author: {
      id: string;
      name: string | null;
      image: string | null;
    };
    category?: {
      name: string;
      slug: string;
    } | null;
    tags: Array<{
      name: string;
      slug: string;
    }>;
    _count: {
      comments: number;
      likes: number;
    };
    viewCount?: number;
  };
  enableViewTransition?: boolean;
  prefetch?: boolean;
}

export function PostCard({ post, enableViewTransition = false, prefetch = false }: PostCardProps) {
  const hasCover = Boolean(post.coverImage);

  return (
    <article
      className={cn(
        "reader-feed-card group grid min-w-0 grid-cols-1 md:items-stretch",
        hasCover
          ? "md:grid-cols-[minmax(0,1fr)_13rem]"
          : "post-card--text-only md:grid-cols-[minmax(0,1fr)_3rem]",
      )}
    >
      <div className="flex min-w-0 flex-col justify-between gap-2.5 p-4 sm:px-5 sm:py-4">
        <div className="space-y-1.5">
          <Link href={`/posts/${post.slug}`} prefetch={prefetch} className="block min-w-0">
            <h3
              className="text-90 line-clamp-2 text-[1.0625rem] font-bold leading-snug transition-colors group-hover:text-[var(--brand)] md:text-[1.125rem]"
              style={
                enableViewTransition
                  ? { viewTransitionName: getPostViewTransitionName("title", post.slug) }
                  : undefined
              }
            >
              {post.title}
            </h3>
          </Link>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {post.featured ? (
              <span className="reader-chip rounded-md border-accent-warm-34 bg-accent-warm-14 px-2 py-0.5 text-[0.7rem] text-accent-warm-78">
                精选
              </span>
            ) : null}

            <PostMeta
              category={post.category}
              hideTagsForMobile={true}
              hideUpdateDate={true}
              publishedAt={post.createdAt}
              tags={post.tags}
              variant="compact"
            />
          </div>

          <p className="text-75 line-clamp-2 text-[0.84375rem] leading-relaxed">{post.excerpt ?? "暂无摘要"}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums text-[var(--text-faint)]">
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
              {post._count.comments} 评论
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Heart aria-hidden="true" className="h-3.5 w-3.5" />
              {post._count.likes} 点赞
            </span>
            {(post.viewCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                {post.viewCount} 阅读
              </span>
            ) : null}
          </div>

          {hasCover ? (
            <Link
              href={`/posts/${post.slug}`}
              prefetch={false}
              aria-label={`继续阅读 ${post.title}`}
              className="reader-card-action sr-only"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {hasCover ? (
        <Link
          href={`/posts/${post.slug}`}
          prefetch={false}
          aria-label={`阅读 ${post.title}`}
          className="theme-media relative mx-3 mb-3 aspect-[1.55] overflow-hidden rounded-xl md:m-2.5 md:ml-0 md:h-auto md:min-h-[8.75rem] md:aspect-auto"
          style={
            enableViewTransition
              ? { viewTransitionName: getPostViewTransitionName("cover", post.slug) }
              : undefined
          }
        >
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            fill
            loading="lazy"
            placeholder="blur"
            blurDataURL={shimmerBlurDataURL}
            quality={70}
            sizes="(min-width: 1800px) 14rem, (max-width: 768px) 100vw, 11rem"
            src={post.coverImage!}
            fallbackSrc={READER_CARD_FALLBACK_SRC}
          />
        </Link>
      ) : (
        <Link
          href={`/posts/${post.slug}`}
          prefetch={false}
          aria-label={`继续阅读 ${post.title}`}
          className="reader-card-action m-2.5 ml-0 hidden w-auto self-stretch md:inline-flex"
        >
          <ChevronRight aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
        </Link>
      )}
    </article>
  );
}
