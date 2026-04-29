import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";
import { PostMeta } from "./PostMeta";

interface PostCardSecondaryProps {
  post: {
    id: string;
    title: string;
    slug: string;
    coverImage?: string | null;
    createdAt: string | Date;
    category?: { name: string; slug: string } | null;
  };
}

export function PostCardSecondary({ post }: PostCardSecondaryProps) {
  const hasCover = Boolean(post.coverImage);

  return (
    <article
      className={cn(
        "reader-card group relative min-h-52 overflow-hidden",
        hasCover ? "theme-media" : "post-card--text-only p-5",
      )}
    >
      {hasCover ? (
        <>
          <FallbackImage
            alt={post.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={75}
            sizes="(max-width: 768px) 100vw, 50vw"
            src={post.coverImage!}
          />
          <div className="absolute inset-0" style={{ background: "var(--reader-media-overlay)" }} />
        </>
      ) : null}

      <div
        className={cn(
          "flex min-h-52 flex-col justify-end gap-3",
          hasCover ? "absolute inset-0 p-5" : "relative min-h-40",
        )}
      >
        <PostMeta
          category={post.category}
          className={hasCover ? "text-[color:color-mix(in_oklab,var(--foreground)_8%,white_92%)]" : undefined}
          hideTagsForMobile
          publishedAt={post.createdAt}
          tags={[]}
          variant="compact"
        />
        <Link href={`/posts/${post.slug}`}>
          <h3
            className={cn(
              "line-clamp-2 text-base font-bold leading-snug transition-colors",
              hasCover
                ? "text-[color:color-mix(in_oklab,var(--foreground)_8%,white_92%)] hover:opacity-85"
                : "text-90 hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)]",
            )}
          >
            {post.title}
          </h3>
        </Link>
        <Link
          href={`/posts/${post.slug}`}
          aria-label={`继续阅读 ${post.title}`}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-full border transition",
            hasCover
              ? "border-[color:color-mix(in_oklab,var(--foreground)_18%,transparent)] bg-[color:color-mix(in_oklab,var(--reader-panel)_48%,transparent)] text-[color:color-mix(in_oklab,var(--foreground)_8%,white_92%)] backdrop-blur-md hover:bg-[color:color-mix(in_oklab,var(--reader-panel)_68%,transparent)]"
              : "border-[var(--reader-border)] text-[var(--text-body)] hover:border-[var(--reader-border-strong)] hover:text-[var(--foreground)]",
          )}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
