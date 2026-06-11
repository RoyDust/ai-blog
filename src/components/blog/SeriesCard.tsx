import { ArrowRight, BookOpenText } from "lucide-react";
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
    <article className="reader-card group overflow-hidden p-0 transition-colors">
      {series.coverImage ? (
        <Link
          href={`/series/${series.slug}`}
          aria-label={`查看系列 ${series.title}`}
          className="theme-media relative block aspect-[2.4] overflow-hidden"
          style={{ viewTransitionName: getSeriesViewTransitionName("cover", series.slug) }}
        >
          <FallbackImage
            alt={series.title}
            className="theme-media-image object-cover"
            fill
            loading="lazy"
            quality={72}
            sizes="(max-width: 768px) 100vw, 720px"
            src={series.coverImage}
          />
        </Link>
      ) : null}

      <div className="space-y-5 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="reader-chip">
                <BookOpenText className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
                连载系列
              </span>
              <span className="text-50 text-xs">{series._count.posts} 篇文章</span>
            </div>

            <Link
              href={`/series/${series.slug}`}
              className="text-90 block text-2xl font-black leading-tight transition group-hover:text-[var(--accent-warm)]"
              style={{ viewTransitionName: getSeriesViewTransitionName("title", series.slug) }}
            >
              {series.title}
            </Link>
            <p className="text-75 line-clamp-3 text-sm leading-7">
              {series.description?.trim() || "按顺序整理的一组文章，适合连续阅读、回顾上下文和建立完整知识路径。"}
            </p>
          </div>
        </div>

        <Link href={`/series/${series.slug}`} className="reader-link inline-flex items-center gap-1 text-sm font-semibold">
          进入系列
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
