import Link from "next/link";
import { BookOpen } from "lucide-react";
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
            <div
              className="relative flex h-full w-full flex-col justify-end overflow-hidden p-8"
              style={{ background: "linear-gradient(135deg, var(--surface-alt) 0%, color-mix(in srgb, var(--surface-alt) 60%, var(--border)) 100%)" }}
            >
              {/* 噪点纹理 */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
                xmlns="http://www.w3.org/2000/svg"
              >
                <filter id="pcf-noise">
                  <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#pcf-noise)" />
              </svg>

              {/* 装饰图标 */}
              <BookOpen
                aria-hidden="true"
                className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-(--text-base) opacity-[0.07]"
                size={110}
                strokeWidth={1}
              />

              {/* 文字内容 */}
              <div className="relative space-y-3">
                {post.category && (
                  <p className="text-50 text-xs font-semibold uppercase tracking-[0.15em]">
                    {post.category.name}
                  </p>
                )}
                <p className="text-75 font-display line-clamp-4 text-2xl font-bold leading-snug">
                  {post.title}
                </p>
              </div>
            </div>
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
