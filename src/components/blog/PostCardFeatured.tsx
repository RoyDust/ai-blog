import Link from "next/link";
import { FallbackImage } from "@/components/ui";

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
  };
}

export function PostCardFeatured({ post }: PostCardFeaturedProps) {
  return (
    <article className="card-base overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_minmax(18rem,0.85fr)]">
        <Link href={`/posts/${post.slug}`} className="theme-media relative min-h-[22rem]">
          {post.coverImage ? (
            <FallbackImage
              alt=""
              className="theme-media-image object-cover"
              fill
              priority
              src={post.coverImage}
            />
          ) : (
            <div className="h-full w-full bg-[var(--surface-alt)]" />
          )}
        </Link>

        <div className="flex flex-col justify-between gap-6 p-6 md:p-8">
          <div className="space-y-4">
            <span className="ui-chip">精选文章</span>
            <div className="space-y-3">
              <Link href={`/posts/${post.slug}`}>
                <h2 className="text-90 font-display text-3xl font-bold leading-tight transition hover:text-[var(--primary)]">
                  {post.title}
                </h2>
              </Link>
              {post.excerpt ? <p className="text-75 text-sm leading-7">{post.excerpt}</p> : null}
            </div>
          </div>

          <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
            <span>{post.category?.name ?? "未分类"}</span>
            <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
