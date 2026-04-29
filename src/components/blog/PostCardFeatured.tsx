import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { FallbackImage } from "@/components/ui";
import { PostMeta } from "./PostMeta";

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
}

export function PostCardFeatured({ post }: PostCardFeaturedProps) {
  return (
    <article className="reader-feature-card group">
      <div className="grid gap-0 lg:grid-cols-[minmax(14rem,0.88fr)_minmax(0,1.12fr)]">
        <Link
          href={`/posts/${post.slug}`}
          aria-label={`阅读封面：${post.title}`}
          className="theme-media relative min-h-[17rem] lg:min-h-[20rem]"
        >
          {post.coverImage ? (
            <FallbackImage
              alt={post.title}
              className="theme-media-image object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 32rem"
              src={post.coverImage}
            />
          ) : (
            <div className="absolute inset-0 flex h-full w-full flex-col justify-between overflow-hidden bg-[var(--reader-panel-muted)] p-6 md:p-8">
              <BookOpen
                aria-hidden="true"
                className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[var(--text-faint)] opacity-20"
                size={110}
                strokeWidth={1}
              />
              <span className="relative w-fit rounded-full border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel)_78%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--text-body)] backdrop-blur-md">
                Night Reader
              </span>
              <div className="relative max-w-md space-y-3">
                <span className="block h-0.5 w-28 rounded-full bg-[color:color-mix(in_oklab,var(--accent-warm)_68%,transparent)]" />
                <p className="line-clamp-3 text-xl font-bold leading-snug text-[var(--foreground)] opacity-80 md:text-2xl">
                  {post.title}
                </p>
              </div>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "var(--reader-media-overlay)" }} />
          {post.coverImage ? (
            <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
              {post.category ? <span className="reader-chip backdrop-blur-md">{post.category.name}</span> : null}
              <span className="hidden rounded-full border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel)_72%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] backdrop-blur-md sm:inline-flex">
                主推
              </span>
            </div>
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-col justify-between gap-7 p-6 md:p-8">
          <div className="space-y-5">
            <span className="reader-chip w-fit border-[color:color-mix(in_oklab,var(--accent-warm)_36%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] text-[color:color-mix(in_oklab,var(--accent-warm)_78%,var(--foreground)_22%)]">
              精选文章
            </span>
            <div className="space-y-4">
              <Link href={`/posts/${post.slug}`}>
                <h2 className="text-90 line-clamp-3 text-2xl font-bold leading-tight transition-colors hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] md:text-3xl">
                  {post.title}
                </h2>
              </Link>
              {post.excerpt ? <p className="text-75 line-clamp-3 text-sm leading-7">{post.excerpt}</p> : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PostMeta
              category={post.category}
              hideTagsForMobile
              publishedAt={post.createdAt}
              tags={post.tags?.slice(0, 2)}
              variant="reader"
            />
            <Link
              href={`/posts/${post.slug}`}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_38%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_16%,transparent)] px-4 py-2 text-sm font-semibold text-[color:color-mix(in_oklab,var(--accent-warm)_80%,var(--foreground)_20%)] transition hover:border-[color:color-mix(in_oklab,var(--accent-warm)_58%,var(--reader-border))] hover:bg-[color:color-mix(in_oklab,var(--accent-warm)_22%,transparent)]"
            >
              继续阅读
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
