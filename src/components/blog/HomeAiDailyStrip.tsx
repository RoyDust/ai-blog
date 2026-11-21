import Link from "next/link";

import { Reveal, SectionHeading, TextLink } from "@/components/editorial";
import { formatIsoDate, formatMonthDay } from "@/lib/editorial-format";

interface AiDailyItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  createdAt: Date | string;
  publishedAt?: Date | string | null;
}

interface HomeAiDailyStripProps {
  posts: AiDailyItem[];
  /** 判断「今日」用的当前时间，测试可注入 */
  now?: Date;
}

const AI_DAILY_HREF = "/series/ai-daily";

function getDailyDate(post: AiDailyItem) {
  return post.publishedAt ?? post.createdAt;
}

/**
 * 首页 AI 日报（简报 15.9 第 3 条）：区块标题 +「全部日报 →」，下面 2:3 两栏、中间 1px 竖线。
 * 左栏是最新一期（当天的写 sky 小字「今日」），右栏往期 4 行；手机上今日在上、往期在下。
 * 当天还没生成时，左栏显示「今日日报生成中」。
 */
export function HomeAiDailyStrip({ posts, now = new Date() }: HomeAiDailyStripProps) {
  if (posts.length === 0) {
    return null;
  }

  const [latest, ...rest] = posts;
  const todayKey = formatIsoDate(now);
  const isToday = formatIsoDate(getDailyDate(latest)) === todayKey;
  const lead = isToday ? latest : null;
  const archive = (isToday ? rest : posts).slice(0, 4);

  return (
    <Reveal as="section" aria-labelledby="home-ai-daily-title" className="space-y-4">
      <SectionHeading id="home-ai-daily-title" title="AI 日报" aside={<TextLink href={AI_DAILY_HREF}>全部日报</TextLink>} />

      <div className="grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-0">
        <div className="min-w-0 md:border-r md:border-[var(--border)] md:pr-6">
          {lead ? (
            <article className="flex h-full flex-col">
              <p className="ed-mono flex items-center gap-2 text-[0.8125rem] text-[var(--text-muted)]">
                <time dateTime={formatIsoDate(getDailyDate(lead))}>{formatIsoDate(getDailyDate(lead))}</time>
                <span className="font-sans text-[0.75rem] font-bold text-[var(--accent-sky)]">今日</span>
              </p>
              <h3 className="mt-2 text-[0.9375rem] font-bold leading-[1.5] text-[var(--foreground)]">
                <Link className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] hover:decoration-[var(--reader-border-strong)]" href={`/posts/${lead.slug}`}>
                  {lead.title}
                </Link>
              </h3>
              {lead.excerpt ? (
                <p className="mt-2 line-clamp-3 text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">{lead.excerpt}</p>
              ) : null}
              <div className="mt-auto pt-4">
                <TextLink href={`/posts/${lead.slug}`}>阅读今日日报</TextLink>
              </div>
            </article>
          ) : (
            <div className="flex h-full flex-col">
              <p className="ed-mono flex items-center gap-2 text-[0.8125rem] text-[var(--text-muted)]">
                <time dateTime={todayKey}>{todayKey}</time>
                <span className="font-sans text-[0.75rem] font-bold text-[var(--accent-sky)]">今日</span>
              </p>
              <p className="mt-2 text-[0.9375rem] leading-[1.7] text-[var(--text-body)]">今日日报生成中</p>
            </div>
          )}
        </div>

        {archive.length > 0 ? (
          <ol aria-label="AI 日报列表" className="min-w-0 border-t border-[var(--border)] md:border-t-0 md:pl-6">
            {archive.map((post) => (
              <li key={post.id} className="border-b border-[var(--border)] last:border-b-0 md:last:border-b">
                <Link
                  href={`/posts/${post.slug}`}
                  className="group flex min-h-11 items-center gap-4 py-2 text-[0.875rem] leading-[1.5] text-[var(--text-body)] transition-colors hover:text-[var(--foreground)]"
                >
                  <time className="ed-mono shrink-0 text-[0.8125rem] text-[var(--text-muted)]" dateTime={formatIsoDate(getDailyDate(post))}>
                    {formatMonthDay(getDailyDate(post))}
                  </time>
                  <span className="min-w-0 truncate underline decoration-transparent underline-offset-4 transition-[text-decoration-color] group-hover:decoration-[var(--reader-border-strong)]">
                    {post.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </Reveal>
  );
}
