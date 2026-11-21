"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

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
  const [activeIndex, setActiveIndex] = useState(0);

  if (posts.length === 0) {
    return null;
  }

  const items = posts.slice(0, 5);
  const safeActiveIndex = activeIndex < items.length ? activeIndex : 0;
  const activePost = items[safeActiveIndex] ?? items[0];
  const activeExcerpt = activePost.excerpt?.trim() || trimDailyTitle(activePost.title);

  return (
    <section className="reader-panel px-4 py-3 sm:px-5 sm:py-3.5" aria-labelledby="home-ai-daily-title">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
          <span aria-hidden="true" className="text-xs font-semibold text-[var(--text-muted)]">
            早读便签 ·
          </span>
          <h2 id="home-ai-daily-title" className="text-[0.8125rem] font-bold text-[var(--foreground)]">
            AI 日报
          </h2>
        </div>
        <Link
          href="/series/ai-daily"
          className="reader-link inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--brand)] transition-colors hover:bg-[var(--btn-regular-bg)]"
        >
          查看全部
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ol
        aria-label="AI 日报列表"
        className="reader-scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-0.5 md:mx-0 md:grid md:grid-cols-2 md:gap-x-3 md:gap-y-1 md:px-0 md:pb-0"
      >
        {items.map((post, index) => {
          const isLead = index === 0;
          const isActive = index === safeActiveIndex;
          return (
            <li
              className={cn(
                "min-w-[82%] snap-start md:min-w-0",
                isLead && "md:col-span-2",
              )}
              key={post.id}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <Link
                href={`/posts/${post.slug}`}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "group flex min-w-0 items-baseline justify-between gap-3 rounded-lg transition-colors",
                  isLead
                    ? "bg-[color:color-mix(in_oklab,var(--btn-regular-bg)_58%,transparent)] px-3 py-2 hover:bg-[var(--btn-regular-bg)]"
                    : cn(
                        "px-2 py-1.5 hover:bg-[var(--btn-plain-bg-hover)]",
                        isActive && "bg-[var(--btn-plain-bg-hover)]",
                      ),
                )}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold tabular-nums",
                      isActive
                        ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                        : "bg-[color:color-mix(in_oklab,var(--foreground)_6%,transparent)] text-[var(--text-muted)] group-hover:text-[var(--brand)]",
                    )}
                  >
                    {formatDailyDate(post.publishedAt ?? post.createdAt)}
                  </span>
                  <span
                    className={cn(
                      "truncate leading-5 transition-colors",
                      isLead
                        ? "text-[0.84375rem] font-semibold text-[var(--foreground)] group-hover:text-[var(--btn-content)]"
                        : "text-xs font-medium text-[var(--text-body)] group-hover:text-[var(--foreground)]",
                    )}
                  >
                    {trimDailyTitle(post.title)}
                  </span>
                </span>
                {isLead ? (
                  <span
                    aria-hidden="true"
                    className="hidden shrink-0 text-xs font-semibold text-[var(--brand)] sm:inline"
                  >
                    展开笔记 ›
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <div
        data-testid="ai-daily-digest"
        className="mt-2.5 flex flex-col gap-2 rounded-xl border border-dashed border-[var(--line-color)] bg-[color:color-mix(in_oklab,var(--surface-alt)_50%,transparent)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-1">
          {items.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="切换日报期数预览">
              {items.map((item, index) => {
                const dateLabel = formatDailyDate(item.publishedAt ?? item.createdAt);
                const selected = index === safeActiveIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`预览 ${dateLabel} 日报摘要`}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                      selected
                        ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {dateLabel}
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="line-clamp-2 text-xs leading-5 text-[var(--text-body)]">{activeExcerpt}</p>
        </div>
        <Link
          href={`/posts/${activePost.slug}`}
          className="shrink-0 self-end text-xs font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)] sm:self-center"
        >
          阅读当期全文 ›
        </Link>
      </div>
    </section>
  );
}
