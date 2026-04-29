import Link from "next/link";
import { CalendarDays, Clock3, Eye, UserRound } from "lucide-react";
import { FallbackImage } from "@/components/ui";

interface ArticleHeroProps {
  title: string;
  excerpt: string | null;
  coverImage?: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string | null; image?: string | null };
  createdAt: Date | string;
  viewCount: number;
  readingTimeMinutes: number;
}

export function ArticleHero({
  title,
  excerpt,
  coverImage,
  category,
  author,
  createdAt,
  viewCount,
  readingTimeMinutes,
}: ArticleHeroProps) {
  return (
    <header className="reader-banner flex min-h-[clamp(22rem,42vw,33rem)] items-end">
      {coverImage ? (
        <FallbackImage
          alt={title}
          className="theme-media-image object-cover opacity-80"
          fill
          priority
          sizes="(min-width: 1280px) 980px, 100vw"
          src={coverImage}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(2_6_23_/_0.82),rgb(2_6_23_/_0.52)_52%,rgb(2_6_23_/_0.28)),var(--reader-media-overlay)]" />

      <div className="relative z-10 grid w-full gap-6 p-6 sm:p-8 lg:p-10">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-white/70">
          <Link className="transition-colors hover:text-white" href="/">
            首页
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="transition-colors hover:text-white" href="/posts">
            文章
          </Link>
          <span aria-hidden="true">/</span>
          {category ? (
            <>
              <Link className="transition-colors hover:text-white" href={`/categories/${category.slug}`}>
                {category.name}
              </Link>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <span className="min-w-0 truncate text-white/55">{title}</span>
        </nav>

        <div className="grid max-w-[var(--reading-max-width)] gap-5">
          {category ? (
            <div>
              <Link className="reader-chip border-white/20 bg-white/10 text-white hover:bg-white/15" href={`/categories/${category.slug}`}>
                {category.name}
              </Link>
            </div>
          ) : null}

          <div className="space-y-4">
            <h1 className="font-display text-4xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl">{title}</h1>
            {excerpt ? <p className="max-w-3xl text-base leading-8 text-white/76 md:text-lg">{excerpt}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-white/72">
          <span className="inline-flex items-center gap-2">
            {author.image ? (
              <FallbackImage alt={author.name ?? "作者头像"} className="rounded-full object-cover" height={24} src={author.image} width={24} />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            {author.name ?? "匿名作者"}
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {new Date(createdAt).toLocaleDateString("zh-CN")}
          </span>
          <span className="inline-flex items-center gap-2">
            <Eye className="h-4 w-4" />
            {viewCount} 阅读
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            预计阅读 {readingTimeMinutes} 分钟
          </span>
        </div>
      </div>
    </header>
  );
}
