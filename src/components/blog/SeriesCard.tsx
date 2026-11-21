import { BookOpenText, ChevronRight } from "lucide-react";
import Link from "next/link";

import { FallbackImage } from "@/components/ui";
import { getSeriesViewTransitionName } from "@/lib/view-transition";

interface SeriesCardProps {
  series: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    coverImage?: string | null;
    _count: {
      posts: number;
    };
  };
}

export function SeriesCard({ series }: SeriesCardProps) {
  return (
    <article className="reader-card group flex h-full flex-col overflow-hidden p-0 transition-colors">
      {series.coverImage ? (
        <Link
          href={`/series/${series.slug}`}
          aria-label={`查看系列 ${series.title}`}
          className="theme-media relative block aspect-[2.35] overflow-hidden"
          style={{ viewTransitionName: getSeriesViewTransitionName("cover", series.slug) }}
        >
          <FallbackImage
            alt={series.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={72}
            sizes="(max-width: 768px) 100vw, 640px"
            src={series.coverImage}
          />
        </Link>
      ) : null}

      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="reader-chip">
              <BookOpenText className="h-3.5 w-3.5 text-[var(--brand)]" aria-hidden="true" />
              连载系列
            </span>
            <span className="rounded-md bg-[var(--surface-alt)]/75 px-2 py-0.5 font-mono text-xs tabular-nums text-[var(--text-muted)]">
              {series._count.posts} 篇文章
            </span>
          </div>

          <Link
            href={`/series/${series.slug}`}
            className="text-90 block text-lg font-bold leading-snug transition-colors group-hover:text-[var(--brand)] md:text-xl"
            style={{ viewTransitionName: getSeriesViewTransitionName("title", series.slug) }}
          >
            {series.title}
          </Link>
          <p className="text-75 line-clamp-2 text-sm leading-6">
            {series.description?.trim() || "按顺序整理的一组文章，适合连续阅读、回顾上下文和建立完整知识路径。"}
          </p>
        </div>

        <Link href={`/series/${series.slug}`} className="reader-link inline-flex items-center gap-0.5 self-end text-xs font-semibold">
          进入系列
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
