import Link from "next/link";

export function HomeHero() {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-10">
      <div className="space-y-2">
        <p className="ui-kicker">编选</p>
        <h1 className="text-90 font-display text-2xl font-bold leading-snug md:text-[1.75rem]">
          按主题读，不按时间刷。
        </h1>
        <p className="text-50 max-w-152 text-sm leading-7">
          工程实践、前端体系、工具记录与长期归档，收成可以持续翻阅的内容地图。
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Link
          className="rounded-xl bg-(--primary) px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          href="/posts"
        >
          开始阅读
        </Link>
        <Link className="btn-plain rounded-xl px-4 py-2 text-sm font-semibold" href="/archives">
          查看归档
        </Link>
      </div>
    </section>
  );
}
