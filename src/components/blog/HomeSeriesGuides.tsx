import Link from "next/link";

import { Reveal, SectionHeading, TextLink } from "@/components/editorial";

export interface HomeSeriesItem {
  id: string;
  title: string;
  slug: string;
  postCount: number;
  latestPostTitle?: string | null;
  /** 每日更新的系列（如 AI 日报）右侧写「每天一篇」而不是篇数 */
  isDaily?: boolean;
}

export interface HomeGuideItem {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
}

const columnLabelClass = "text-[0.8125rem] font-bold tracking-[0.08em] text-[var(--text-muted)]";
const rowTitleLink =
  "ed-serif text-[1rem] leading-[1.45] text-[var(--foreground)] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[var(--reader-border-strong)]";

/**
 * 首页「系列与专题」（简报 15.9 第 5 条）：两栏、中间 1px 竖线；md 以下上下排。
 * 左「系列」3 行（衬线系列名、右侧等宽篇数、下一行「最新：…」），右「专题指南」2 行。
 */
export function HomeSeriesGuides({ series, guides }: { series: HomeSeriesItem[]; guides: HomeGuideItem[] }) {
  if (series.length === 0 && guides.length === 0) {
    return null;
  }

  return (
    <Reveal as="section" aria-labelledby="home-series-guides-title" className="space-y-3">
      <SectionHeading id="home-series-guides-title" title="系列与专题" />

      <div className="grid gap-8 md:grid-cols-2 md:gap-0">
        {series.length > 0 ? (
          <div className="flex min-w-0 flex-col md:border-r md:border-[var(--border)] md:pr-6">
            <h3 className={columnLabelClass}>系列</h3>
            <ul className="mt-2">
              {series.slice(0, 3).map((item) => (
                <li key={item.id} className="border-b border-[var(--border)]">
                  <Link href={`/series/${item.slug}`} className="group block min-h-11 py-3">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={rowTitleLink}>{item.title}</span>
                      <span className="ed-mono shrink-0 text-[0.75rem] text-[var(--text-muted)]">
                        {item.isDaily ? <span className="font-sans">每天一篇</span> : `${item.postCount} 篇`}
                      </span>
                    </span>
                    {item.latestPostTitle ? (
                      <span className="mt-1 block truncate text-[0.8125rem] text-[var(--text-muted)]">最新：{item.latestPostTitle}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <TextLink href="/series">全部系列</TextLink>
            </div>
          </div>
        ) : null}

        {guides.length > 0 ? (
          <div className="flex min-w-0 flex-col border-t border-[var(--border)] pt-6 md:border-t-0 md:pl-6 md:pt-0">
            <h3 className={columnLabelClass}>专题指南</h3>
            <ul className="mt-2">
              {guides.slice(0, 2).map((guide) => (
                <li key={guide.id} className="border-b border-[var(--border)]">
                  <Link href={`/guides/${guide.slug}`} className="group block min-h-11 py-3">
                    <span className={rowTitleLink}>{guide.title}</span>
                    {guide.description ? (
                      <span className="mt-1 block truncate text-[0.8125rem] text-[var(--text-muted)]">{guide.description}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <TextLink href="/guides">全部指南</TextLink>
            </div>
          </div>
        ) : null}
      </div>
    </Reveal>
  );
}
