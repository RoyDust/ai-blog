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
    <main className="mx-auto min-h-screen max-w-[72rem] px-4 py-10 md:px-6 md:py-1">
      <div className="mx-auto max-w-5xl">
        <section className="mt-0 rounded-[calc(var(--radius-large)+0.5rem)] border border-[var(--border)] bg-[var(--surface)]/90 px-6 py-8 shadow-[0_28px_80px_-50px_rgba(15,23,42,0.45)] md:px-10 md:py-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Saved Reading</p>
              <h1 className="text-4xl font-black tracking-[-0.05em] text-[var(--foreground)] md:text-6xl">我的收藏</h1>
              <p className="max-w-xl text-sm leading-7 text-[var(--muted)] md:text-base">留下一些值得反复阅读的内容。</p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)]">
              <Bookmark className="h-4 w-4 text-[var(--primary)]" />
              <span>{countLabel}</span>
            </div>
          </div>
        </section>

        {bookmarks.length > 0 ? (
          <section className="mt-8 space-y-5" data-bookmark-shelf="true">
            {bookmarks.map((bookmark) => (
              <article key={bookmark.slug} className="card-base p-6 transition hover:border-[var(--border-strong)] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)]">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>Local Save</span>
                  <span>•</span>
                  <span>{bookmark.createdAt ? new Date(bookmark.createdAt).toLocaleDateString("zh-CN") : "刚刚收藏"}</span>
                </div>
                <Link href={`/posts/${bookmark.slug}`} className="mt-3 block text-2xl font-black tracking-[-0.03em] text-[var(--foreground)] transition hover:text-[var(--primary)]">
                  {bookmark.title}
                </Link>
                {bookmark.excerpt ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{bookmark.excerpt}</p> : null}
                <div className="mt-6">
                  <Link href={`/posts/${bookmark.slug}`} className="inline-flex items-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]">
                    打开文章
                  </Link>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-[var(--radius-large)] border border-dashed border-[var(--border)] bg-[var(--surface)]/75 px-6 py-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Nothing Saved Yet</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--foreground)]">这里还没有留下任何内容</h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--muted)]">当你收藏一篇文章，它会安静地留在这里。</p>
            <Link href="/posts" className="mt-8 inline-flex items-center rounded-full border border-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)]">
              去看看文章
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
