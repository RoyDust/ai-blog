"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { getBookmarks, type BookmarkRecord } from "@/lib/bookmark-store";

export function BookmarksPageClient() {
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>(() => getBookmarks());

  useEffect(() => {
    const syncBookmarks = () => {
      setBookmarks(getBookmarks());
    };

    window.addEventListener("storage", syncBookmarks);
    window.addEventListener("bookmarks:changed", syncBookmarks as EventListener);

    return () => {
      window.removeEventListener("storage", syncBookmarks);
      window.removeEventListener("bookmarks:changed", syncBookmarks as EventListener);
    };
  }, []);

  const countLabel = `已收藏 ${String(bookmarks.length).padStart(2, "0")} 篇`;

  return (
    <div className="reader-section">
      <section className="reader-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <span className="reader-chip">本地书签</span>
            <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">我的收藏</h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--text-body)]">留下一些值得反复阅读的内容。</p>
          </div>

          <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg bg-[var(--btn-regular-bg)] px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-[var(--btn-content)]">
            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{countLabel}</span>
          </div>
        </div>
      </section>

      {bookmarks.length > 0 ? (
        <section className="grid gap-3" data-bookmark-shelf="true">
          {bookmarks.map((bookmark) => (
            <article key={bookmark.slug} className="reader-feed-card group p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
                <span className="font-mono tabular-nums">
                  {bookmark.createdAt ? new Date(bookmark.createdAt).toLocaleDateString("zh-CN") : "刚刚收藏"}
                </span>
                <Link href={`/posts/${bookmark.slug}`} className="reader-link text-xs font-semibold">
                  打开文章 ›
                </Link>
              </div>
              <Link
                href={`/posts/${bookmark.slug}`}
                className="mt-2 block text-lg font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)] md:text-xl"
              >
                {bookmark.title}
              </Link>
              {bookmark.excerpt ? (
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--text-body)]">{bookmark.excerpt}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="reader-panel px-6 py-12 text-center">
          <h2 className="text-90 font-display text-xl font-bold md:text-2xl">这里还没有留下任何内容</h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-6 text-[var(--text-muted)]">当你收藏一篇文章，它会安静地留在这里。</p>
          <Link href="/posts" className="home-primary-cta mt-5">
            去看看文章
          </Link>
        </section>
      )}
    </div>
  );
}
