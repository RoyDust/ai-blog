import { FallbackImage } from "@/components/ui";
import Link from "next/link";
import { ChevronRight, Eye, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { PostMeta } from "./PostMeta";

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
}

export function PostCard({ post }: PostCardProps) {
  const hasCover = Boolean(post.coverImage);

  return (
    <article
      className={cn(
        "reader-feed-card group min-w-0 p-4",
        hasCover
          ? "grid gap-4 md:grid-cols-[10.75rem_minmax(0,1fr)_2.75rem] md:items-center md:p-4"
          : "post-card--text-only grid gap-3 p-5 md:p-6",
      )}
    >
      {hasCover ? (
        <Link
          href={`/posts/${post.slug}`}
          aria-label={`阅读 ${post.title}`}
          className="theme-media relative aspect-[1.55] overflow-hidden rounded-[calc(var(--radius-large)-0.25rem)] md:h-28 md:aspect-auto"
        >
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={72}
            sizes="(max-width: 768px) 100vw, 11rem"
            src={post.coverImage!}
          />
        </Link>
      ) : (
        <div className="post-card-text-accent" data-testid="post-card-text-accent">
          <span className="post-card-text-accent-label">夜读札记</span>
        </div>
      )}

      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {post.featured ? (
            <span className="reader-chip border-[color:color-mix(in_oklab,var(--accent-warm)_34%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] text-[color:color-mix(in_oklab,var(--accent-warm)_78%,var(--foreground)_22%)]">
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

        <Link href={`/posts/${post.slug}`} className="block min-w-0">
          <h3 className="text-90 line-clamp-2 text-lg font-bold leading-snug transition-colors group-hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] md:text-xl">
            {post.title}
          </h3>
        </Link>

        <p className="text-75 line-clamp-2 text-sm leading-6 md:line-clamp-3">{post.excerpt ?? "暂无摘要"}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-faint)]">
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
      </div>

      {hasCover ? (
        <Link
          href={`/posts/${post.slug}`}
          aria-label={`继续阅读 ${post.title}`}
          className="reader-icon-btn hidden self-center justify-self-end md:inline-flex"
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </Link>
      ) : null}
    </article>
  );
}
