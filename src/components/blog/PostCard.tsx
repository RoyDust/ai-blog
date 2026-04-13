import { FallbackImage } from "@/components/ui";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PostMeta } from "./PostMeta";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
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
    <article className="card-base grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:p-6">
      <div className="space-y-3">
        <PostMeta
          category={post.category}
          hideTagsForMobile={true}
          hideUpdateDate={true}
          publishedAt={post.createdAt}
          tags={post.tags}
        />

        <Link href={`/posts/${post.slug}`} className="group block">
          <h3 className="text-90 text-[1.65rem] font-bold leading-tight transition group-hover:text-[var(--primary)]">
            {post.title}
          </h3>
        </Link>

        <p className="text-75 line-clamp-3 text-sm leading-7">{post.excerpt ?? "暂无摘要"}</p>

        <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
          <span>{post._count.comments} 评论</span>
          <span>{post._count.likes} 点赞</span>
          {(post.viewCount ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount} 阅读
            </span>
          ) : null}
        </div>
      </div>

      <Link
        href={`/posts/${post.slug}`}
        aria-label={post.title}
        className="theme-media relative order-first aspect-[4/3] overflow-hidden rounded-2xl md:order-none"
      >
        {hasCover ? (
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={70}
            sizes="(max-width: 768px) 100vw, 15rem"
            src={post.coverImage!}
          />
        ) : (
          <div className="h-full w-full bg-[var(--surface-alt)]" />
        )}
      </Link>
    </article>
  );
}
