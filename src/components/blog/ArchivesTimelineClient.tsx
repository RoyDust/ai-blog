"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export interface ArchiveTimelinePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  createdAt: Date | string;
  generatedByAiNews?: boolean;
  category: { name: string; slug: string } | null;
}

type ArchiveFilterType = "all" | "original" | "ai-daily";

function formatMonthDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function ArchivesTimelineClient({ posts }: { posts: ArchiveTimelinePost[] }) {
  const [filter, setFilter] = useState<ArchiveFilterType>("all");

  const counts = useMemo(() => {
    let original = 0;
    let aiDaily = 0;
    for (const post of posts) {
      if (post.generatedByAiNews) {
        aiDaily += 1;
      } else {
        original += 1;
      }
    }
    return { all: posts.length, original, aiDaily };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (filter === "original") {
      return posts.filter((post) => !post.generatedByAiNews);
    }
    if (filter === "ai-daily") {
      return posts.filter((post) => Boolean(post.generatedByAiNews));
    }
    return posts;
  }, [filter, posts]);

  const groups = useMemo(() => {
    const map = new Map<string, ArchiveTimelinePost[]>();
    for (const post of filteredPosts) {
      const year = new Date(post.createdAt).getFullYear().toString();
      const yearPosts = map.get(year) ?? [];
      yearPosts.push(post);
      map.set(year, yearPosts);
    }
    return [...map.entries()];
  }, [filteredPosts]);

  return (
    <section
      aria-label="按年份归档时间线"
      className="reader-panel onload-animation px-5 py-5 md:px-6 md:py-6"
      style={{ animationDelay: "60ms" }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-[var(--line-color)] pb-3.5">
        <div
          role="group"
          aria-label="归档内容类型筛选"
          className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[var(--surface-alt)]/75 p-1"
        >
          {(
            [
              { id: "all", label: "全部", count: counts.all },
              { id: "original", label: "原创文章", count: counts.original },
              { id: "ai-daily", label: "AI 日报", count: counts.aiDaily },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "inline-flex h-7.5 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                )}
              >
                <span>{item.label}</span>
                <span className="font-mono text-[11px] tabular-nums opacity-80">{item.count}</span>
              </button>
            );
          })}
        </div>
        <span className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
          当前显示 {filteredPosts.length} 篇
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">当前筛选下暂无归档文章。</p>
      ) : (
        <div className="space-y-6">
          {groups.map(([year, yearPosts]) => (
            <div key={year}>
              <div className="mb-2 grid grid-cols-[3.5rem_1.5rem_minmax(0,1fr)] items-baseline">
                <h2 className="font-mono text-xl font-extrabold tabular-nums text-[var(--foreground)]">{year}</h2>
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 justify-self-center rounded-full border-2 border-[var(--brand)] bg-[var(--card-bg)]"
                />
                <span className="text-xs text-[var(--text-muted)]">{yearPosts.length} 篇</span>
              </div>

              <div>
                {yearPosts.map((post) => {
                  const postDate = new Date(post.createdAt);
                  return (
                    <Link
                      key={post.id}
                      href={`/posts/${post.slug}`}
                      className="reader-feed-card !border-0 !bg-transparent !shadow-none hover:!bg-[var(--btn-regular-bg)] group -mx-2 grid h-10 grid-cols-[3.5rem_1.5rem_minmax(0,1fr)_auto] items-center rounded-lg px-2 transition-colors"
                    >
                      <time
                        dateTime={postDate.toISOString()}
                        className="font-mono text-xs tabular-nums text-[var(--text-muted)]"
                      >
                        {formatMonthDay(postDate)}
                      </time>
                      <span
                        aria-hidden="true"
                        className="relative flex h-full items-center justify-center before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-1/2 before:border-l before:border-dashed before:border-[var(--line-color)]"
                      >
                        <i className="relative z-10 h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] transition-all duration-150 group-hover:scale-150 group-hover:bg-[var(--brand)]" />
                      </span>
                      <span className="truncate pr-3 text-sm font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)]">
                        {post.title}
                      </span>
                      {post.category ? (
                        <span className="hidden shrink-0 rounded-md bg-[var(--surface-alt)]/75 px-2 py-0.5 text-xs text-[var(--text-muted)] sm:inline-block">
                          #{post.category.name}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
