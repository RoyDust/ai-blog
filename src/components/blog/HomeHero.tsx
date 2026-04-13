import Link from "next/link";
import { PostCardFeatured } from "./PostCardFeatured";

interface HomeHeroProps {
  featuredPost: {
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage?: string | null;
    createdAt: Date | string;
    category: { name: string; slug: string } | null;
  } | null;
}

export function HomeHero({ featuredPost }: HomeHeroProps) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="card-base flex flex-col justify-between gap-8 p-6 md:p-8">
        <div className="space-y-4">
          <p className="ui-kicker">编选</p>
          <h1 className="text-90 font-display text-4xl font-bold leading-tight md:text-5xl">
            围绕主题，而不是时间线，浏览这座博客。
          </h1>
          <p className="text-75 max-w-[40rem] text-base leading-8">
            从工程实践、前端体系、工具记录到长期归档，把零散文章收成可持续阅读的内容入口。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className="ui-btn rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/posts">
            开始阅读
          </Link>
          <Link className="btn-plain rounded-xl px-5 py-3 text-sm font-semibold" href="/archives">
            查看归档
          </Link>
        </div>
      </div>

      {featuredPost ? (
        <PostCardFeatured post={featuredPost} />
      ) : (
        <div className="card-base flex min-h-[22rem] flex-col justify-between gap-6 p-8">
          <div className="space-y-3">
            <p className="ui-kicker">欢迎</p>
            <h2 className="text-90 font-display text-3xl font-bold leading-tight">从最新文章、归档或关键词开始。</h2>
            <p className="text-75 text-sm leading-7">
              当前还没有单独置顶的精选文章，先从文章索引和归档入口进入也能完整浏览本站内容。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="ui-btn rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href="/posts">
              浏览文章索引
            </Link>
            <Link className="btn-plain rounded-xl px-5 py-3 text-sm font-semibold" href="/search">
              搜索关键词
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
