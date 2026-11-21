"use client";

import { useSyncExternalStore } from "react";
import { PostCard } from "@/components/blog/PostCard";
import { EmptyState, ListRowSkeleton, Masthead, Reveal, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { BOOKMARK_STORAGE_KEY, getBookmarks, type BookmarkRecord } from "@/lib/bookmark-store";

/*
 * 收藏存在 localStorage：用 useSyncExternalStore 订阅，服务端与水合阶段拿到 null（显示细条骨架），
 * 避免服务端空列表与浏览器真实列表不一致。快照按原始字符串缓存，保证引用稳定。
 */
let cachedRaw: string | null | undefined;
let cachedBookmarks: BookmarkRecord[] = [];

function readBookmarksSnapshot(): BookmarkRecord[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedBookmarks = getBookmarks();
  }

  return cachedBookmarks;
}

function readServerSnapshot(): BookmarkRecord[] | null {
  return null;
}

function subscribeBookmarks(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("bookmarks:changed", onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("bookmarks:changed", onChange);
  };
}

/**
 * 我的收藏（方向 A，README「还没画的」：套用列表行与专题头规则）：
 * 报头 eyebrow「收藏」+ 衬线 h1 + 一句说明 + 等宽计数，2px 粗线收尾；
 * 下面是全站唯一的文章列表行（PostCard），左列等宽序号、meta 写收藏日期；空态一句衬线文案 + 文字链接。
 */
export function BookmarksPageClient() {
  const snapshot = useSyncExternalStore<BookmarkRecord[] | null>(subscribeBookmarks, readBookmarksSnapshot, readServerSnapshot);
  const bookmarks = snapshot ?? [];
  const countLabel = snapshot ? `已收藏 ${String(bookmarks.length).padStart(2, "0")} 篇` : "正在读取收藏…";

  return (
    <div className="space-y-2">
      <Reveal>
        <Masthead eyebrow="收藏" title="我的收藏" description="留下一些值得反复阅读的内容。" meta={countLabel} />
      </Reveal>

      {snapshot === null ? (
        <ListRowSkeleton count={3} label="正在读取收藏" />
      ) : bookmarks.length > 0 ? (
        <section aria-label="收藏的文章" data-bookmark-shelf="true">
          <StaggerList>
            {bookmarks.map((bookmark, index) => (
              <StaggerItem key={bookmark.slug}>
                <PostCard
                  dateStyle="index"
                  headingLevel="h2"
                  index={index + 1}
                  post={{
                    id: bookmark.slug,
                    slug: bookmark.slug,
                    title: bookmark.title,
                    excerpt: bookmark.excerpt ?? null,
                    createdAt: bookmark.createdAt ?? "",
                    tags: [],
                  }}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        </section>
      ) : (
        <Reveal delay={0.06}>
          <EmptyState
            title="这里还没有留下任何内容"
            description="当你收藏一篇文章，它会安静地留在这里。"
            actions={<TextLink href="/posts">去看看文章</TextLink>}
          />
        </Reveal>
      )}
    </div>
  );
}
