import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Eye } from "lucide-react";
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
  const hasCover = !!post.coverImage;

  return (
    <>
      <div className="card-base relative flex w-full flex-col-reverse overflow-hidden rounded-[var(--radius-large)] md:flex-col">
        <div
          className={`relative pb-6 pl-6 pr-6 pt-6 md:pl-9 md:pr-2 md:pt-7 ${
            hasCover ? "w-full md:w-[calc(100%-28%-12px)]" : "w-full md:w-[calc(100%-52px-12px)]"
          }`}
        >
          <Link
            href={`/posts/${post.slug}`}
            className="group text-90 mb-3 block w-full font-bold transition hover:text-[var(--primary)]"
          >
            <span className="relative block pr-10 text-3xl before:absolute before:top-[10px] before:left-[-18px] before:hidden before:h-5 before:w-1 before:rounded-md before:bg-[var(--primary)] md:before:block">
              {post.title}
            </span>
            <ChevronRight className="absolute top-0 right-0 inline h-8 w-8 translate-y-0.5 text-[var(--primary)] md:hidden" />
            <ChevronRight className="absolute top-0 right-0 hidden h-8 w-8 -translate-x-1 translate-y-0.5 text-[var(--primary)] opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 md:inline" />
          </Link>

          <PostMeta category={post.category} hideTagsForMobile={true} hideUpdateDate={true} publishedAt={post.createdAt} tags={post.tags} className="mb-4" />

          <div className="text-75 mb-3.5 line-clamp-2 pr-4 transition md:line-clamp-1">{post.excerpt ?? "暂无摘要"}</div>

          <div className="text-30 flex gap-4 text-sm transition">
            <div>{post._count.comments} 评论</div>
            <div>|</div>
            <div>{post._count.likes} 点赞</div>
            {(post.viewCount ?? 0) > 0 && (
              <>
                <div>|</div>
                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {post.viewCount}
                </div>
              </>
            )}
          </div>
        </div>

        {hasCover ? (
          <Link
            href={`/posts/${post.slug}`}
            aria-label={post.title}
            className="group relative mx-4 mt-4 -mb-2 max-h-[20vh] overflow-hidden rounded-xl transition-transform active:scale-95 md:absolute md:top-3 md:right-3 md:bottom-3 md:mx-0 md:mt-0 md:mb-0 md:max-h-none md:w-[28%]"
          >
            <div className="absolute z-10 h-full w-full bg-transparent transition group-hover:bg-black/30 group-active:bg-black/50" />
            <div className="absolute z-20 flex h-full w-full items-center justify-center">
              <ChevronRight className="scale-50 text-5xl text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
            </div>
            <Image
              alt={post.title}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 28vw, 400px"
              src={post.coverImage!}
            />
          </Link>
        ) : (
          <Link
            href={`/posts/${post.slug}`}
            aria-label={post.title}
            className="btn-regular !hidden absolute top-3 right-3 bottom-3 w-[3.25rem] rounded-xl bg-[var(--enter-btn-bg)] active:scale-95 hover:bg-[var(--enter-btn-bg-hover)] md:!flex"
          >
            <ChevronRight className="mx-auto text-4xl text-[var(--primary)]" />
          </Link>
        )}
      </div>

      <div className="mx-6 border-t border-dashed border-black/10 transition last:border-t-0 dark:border-white/[0.15] md:hidden" />
    </>
  );
}
