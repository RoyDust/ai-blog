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
  const cardClassName = hasCover
    ? "card-base relative grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start md:p-5"
    : "card-base relative grid gap-3 p-4 md:p-5";

  return (
    <article className={cardClassName}>
      {post.featured ? (
        <span className="absolute inset-y-0 left-0 w-0.75 rounded-l-[inherit] bg-(--primary)" />
      ) : null}

      <div className="space-y-2">
        <PostMeta
          category={post.category}
          hideTagsForMobile={true}
          hideUpdateDate={true}
          publishedAt={post.createdAt}
          tags={post.tags}
        />

        <Link href={`/posts/${post.slug}`} className="group block">
          <h3 className="text-90 text-lg font-bold leading-snug transition group-hover:text-(--primary)">
            {post.title}
          </h3>
        </Link>

        <p className="text-75 line-clamp-2 text-sm leading-6">{post.excerpt ?? "暂无摘要"}</p>

        <div className="text-50 flex flex-wrap items-center gap-3 text-xs">
          <span>{post._count.comments} 评论</span>
          <span>{post._count.likes} 点赞</span>
          {(post.viewCount ?? 0) > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {post.viewCount} 阅读
            </span>
          ) : null}
        </div>
      </div>

      {hasCover ? (
        <Link
          href={`/posts/${post.slug}`}
          aria-label={post.title}
          className="theme-media relative order-first aspect-4/3 overflow-hidden rounded-xl md:order-0"
        >
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={70}
            sizes="(max-width: 768px) 100vw, 12rem"
            src={post.coverImage!}
          />
        </Link>
      ) : null}
    </article>
  );
}
