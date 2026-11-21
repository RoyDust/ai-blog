import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";

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
}

function formatDailyDate(value: Date | string | null | undefined) {
  if (!value) {
    return "近期";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "近期";
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function trimDailyTitle(title: string) {
  return title.replace(/^\d{4}-\d{2}-\d{2}\s*AI\s*日报[：:]\s*/, "");
}

export function HomeAiDailyStrip({ posts }: HomeAiDailyStripProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="reader-panel p-4 sm:p-5" aria-labelledby="home-ai-daily-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="home-ai-daily-title" className="reader-section-heading">
          AI 日报
        </h2>
        <Link
          href="/series/ai-daily"
          className="reader-link inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[color:color-mix(in_oklab,var(--accent-sky)_66%,var(--foreground)_34%)]"
        >
          查看全部
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ol
        aria-label="AI 日报列表"
        className="reader-scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 md:pb-0"
      >
        {posts.slice(0, 5).map((post) => (
          <li
            className="min-w-[82%] snap-start border-l border-[var(--reader-border)] pl-3 first:border-l-0 first:pl-0 md:min-w-0"
            key={post.id}
          >
            <Link
              href={`/posts/${post.slug}`}
              className="group block h-full min-w-0 py-1"
            >
              <span className="mb-2 flex items-center gap-1.5 text-[0.72rem] font-medium tabular-nums text-[var(--text-muted)]">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-[var(--accent-sky)]" />
                {formatDailyDate(post.publishedAt ?? post.createdAt)}
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-5 text-[var(--text-body)] transition-colors group-hover:text-[var(--foreground)]">
                {trimDailyTitle(post.title)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
