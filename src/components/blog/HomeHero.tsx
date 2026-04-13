import Link from "next/link";

export function HomeHero() {
  return (
    <section className="card-base flex flex-col justify-between gap-8 p-6 md:p-8">
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
    </section>
  );
}
