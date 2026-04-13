import Link from "next/link";

interface ArticleHeroProps {
  title: string;
  excerpt: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string | null };
  createdAt: Date | string;
  viewCount: number;
  readingTimeMinutes: number;
}

export function ArticleHero({
  title,
  excerpt,
  category,
  author,
  createdAt,
  viewCount,
  readingTimeMinutes,
}: ArticleHeroProps) {
  return (
    <header className="space-y-5 border-b border-[var(--border)] pb-8">
      <nav aria-label="Breadcrumb" className="text-50 text-sm">
        <Link href="/">首页</Link>
        <span className="mx-2">/</span>
        {category ? (
          <>
            <Link href={`/categories/${category.slug}`}>{category.name}</Link>
            <span className="mx-2">/</span>
          </>
        ) : null}
        <span>{title}</span>
      </nav>

      {category ? (
        <div>
          <Link className="ui-chip" href={`/categories/${category.slug}`}>
            {category.name}
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <h1 className="text-90 font-display text-4xl font-extrabold leading-tight md:text-5xl">{title}</h1>
        {excerpt ? <p className="text-75 max-w-[var(--reading-max-width)] text-base leading-8">{excerpt}</p> : null}
      </div>

      <div className="text-50 flex flex-wrap items-center gap-3 text-sm">
        <span>{author.name ?? "匿名作者"}</span>
        <span>{new Date(createdAt).toLocaleDateString("zh-CN")}</span>
        <span>{viewCount} 阅读</span>
        <span>预计阅读 {readingTimeMinutes} 分钟</span>
      </div>
    </header>
  );
}
