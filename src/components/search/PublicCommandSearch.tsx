"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  Archive,
  ArrowRight,
  Bookmark,
  BookOpenText,
  FileText,
  Home,
  ListTree,
  Moon,
  Search,
  Sparkles,
  Sun,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import { useTheme } from "@/components/ThemeProvider";
import { apiFetcher, toErrorMessage } from "@/lib/client-api";

type PublicSearchApiItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: { name: string | null; slug: string | null } | null;
};

type PublicSearchApiResponse = {
  success: boolean;
  data: PublicSearchApiItem[];
  pagination?: {
    total: number;
  };
};

type QuickLinkItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
};

const QUICK_LINKS: QuickLinkItem[] = [
  { id: "home", title: "首页", subtitle: "返回最新文章与早读便签", href: "/", icon: Home, keywords: ["home", "index"] },
  { id: "original-posts", title: "原创文章", subtitle: "只看作者原创技术文章，过滤 AI 日报", href: "/posts?type=original", icon: Sparkles, keywords: ["original", "essay", "posts"] },
  { id: "all-posts", title: "全部文章", subtitle: "按分类与标签筛选全部内容", href: "/posts", icon: BookOpenText, keywords: ["posts", "articles", "blog"] },
  { id: "series", title: "系列专栏", subtitle: "按主题连续阅读成体系文章", href: "/series", icon: ListTree, keywords: ["series", "column"] },
  { id: "archives", title: "时间归档", subtitle: "按年份回溯历史文章时间线", href: "/archives", icon: Archive, keywords: ["archives", "timeline"] },
  { id: "bookmarks", title: "本地书签", subtitle: "查看收藏过的待读文章", href: "/bookmarks", icon: Bookmark, keywords: ["bookmarks", "saved"] },
  { id: "about", title: "关于作者", subtitle: "了解站点背景与联系方式", href: "/about", icon: UserRound, keywords: ["about", "author", "profile"] },
];

function CommandGroupBlock({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="px-2 py-1.5 text-[var(--foreground)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--text-muted)]"
    >
      <div className="space-y-0.5">{children}</div>
    </Command.Group>
  );
}

export function PublicCommandSearch() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim();
  const queryCharCount = Array.from(normalizedQuery).length;
  const shouldFetchRemote = open && queryCharCount >= 2;

  const {
    data: searchResponse,
    error: searchError,
    isLoading: searchLoading,
  } = useSWR<PublicSearchApiResponse>(
    shouldFetchRemote ? `/api/search?q=${encodeURIComponent(normalizedQuery)}&limit=8` : null,
    apiFetcher,
    { keepPreviousData: true },
  );

  const posts = searchResponse?.data ?? [];
  const totalMatches = searchResponse?.pagination?.total ?? posts.length;
  const loading = shouldFetchRemote && searchLoading;
  const errorMessage = searchError ? toErrorMessage(searchError, "搜索暂时不可用") : null;

  const matchingQuickLinks = useMemo(() => {
    if (!normalizedQuery) return QUICK_LINKS.slice(0, 5);
    const lowered = normalizedQuery.toLowerCase();
    return QUICK_LINKS.filter((item) =>
      [item.title, item.subtitle, item.href, ...item.keywords].join(" ").toLowerCase().includes(lowered),
    );
  }, [normalizedQuery]);

  const detectedShortcutLabel =
    typeof window !== "undefined" && /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? "⌘K" : "Ctrl K";
  if (detectedShortcutLabel !== shortcutLabel) {
    setShortcutLabel(detectedShortcutLabel);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigateTo(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="快速搜索与命令面板"
          title={`快速搜索 (${shortcutLabel})`}
          className="hidden h-8.5 shrink-0 items-center gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-2 font-mono text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] sm:inline-flex"
        >
          <span>{shortcutLabel}</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[11vh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--reader-border)] bg-[var(--float-panel-bg)] shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">全站快速搜索与导航</Dialog.Title>
          <Dialog.Description className="sr-only">输入关键词即时检索文章，或快速跳转前台页面与切换主题。</Dialog.Description>

          <Command shouldFilter={false} loop className="flex max-h-[min(76vh,38rem)] flex-col">
            <div className="flex items-center gap-2.5 border-b border-[var(--line-color)] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden="true" />
              <Command.Input
                autoFocus
                aria-label="输入关键词搜索文章"
                value={query}
                onValueChange={setQuery}
                placeholder="搜索文章标题、摘要，或直接跳转页面…"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <Dialog.Close
                aria-label="关闭快速搜索"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <Command.List className="min-h-[14rem] overflow-y-auto p-2">
              {normalizedQuery ? (
                <CommandGroupBlock heading="全文检索">
                  <Command.Item
                    value={`full-search-${normalizedQuery}`}
                    onSelect={() => navigateTo(`/search?q=${encodeURIComponent(normalizedQuery)}`)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-colors data-[selected=true]:bg-[var(--btn-regular-bg)] data-[selected=true]:text-[var(--btn-content)]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Search className="h-4 w-4 shrink-0 text-[var(--brand)]" aria-hidden="true" />
                      <span className="truncate font-medium">
                        查看「{normalizedQuery}」的完整搜索与 AI 导读
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  </Command.Item>
                </CommandGroupBlock>
              ) : null}

              {posts.length > 0 ? (
                <CommandGroupBlock heading={`匹配文章 (${totalMatches})`}>
                  {posts.map((post) => (
                    <Command.Item
                      key={post.id}
                      value={`post-${post.slug}-${post.title}`}
                      onSelect={() => navigateTo(`/posts/${post.slug}`)}
                      className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors data-[selected=true]:bg-[var(--btn-regular-bg)]"
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-[var(--btn-content)]">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                          {post.title}
                        </span>
                        {post.excerpt ? (
                          <span className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                            {post.excerpt}
                          </span>
                        ) : null}
                      </span>
                      {post.category?.name ? (
                        <span className="shrink-0 rounded-md bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                          #{post.category.name}
                        </span>
                      ) : null}
                    </Command.Item>
                  ))}
                </CommandGroupBlock>
              ) : null}

              {matchingQuickLinks.length > 0 ? (
                <CommandGroupBlock heading={normalizedQuery ? "相关入口" : "快速跳转"}>
                  {matchingQuickLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`nav-${item.id}-${item.title}`}
                        onSelect={() => navigateTo(item.href)}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors data-[selected=true]:bg-[var(--btn-regular-bg)]"
                      >
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--brand)]">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{item.title}</span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">{item.subtitle}</span>
                        </span>
                      </Command.Item>
                    );
                  })}
                </CommandGroupBlock>
              ) : null}

              {!normalizedQuery ? (
                <CommandGroupBlock heading="阅读偏好">
                  <Command.Item
                    value="toggle-reader-theme"
                    onSelect={() => {
                      toggleTheme();
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors data-[selected=true]:bg-[var(--btn-regular-bg)]"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--brand)]">
                      {theme === "dark" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {theme === "dark" ? "切换到日间阅读模式" : "切换到夜间阅读模式"}
                    </span>
                  </Command.Item>
                </CommandGroupBlock>
              ) : null}

              {queryCharCount === 1 ? (
                <div className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
                  再输入至少 1 个字符即可即时预览匹配文章，或直接按回车前往搜索页
                </div>
              ) : null}
              {loading ? <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">正在检索文章…</div> : null}
              {errorMessage ? <div className="px-4 py-6 text-center text-xs text-[var(--danger-foreground)]">{errorMessage}</div> : null}
              {queryCharCount >= 2 && !loading && !errorMessage && posts.length === 0 && matchingQuickLinks.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">未找到直接匹配的文章，可按回车尝试完整搜索</div>
              ) : null}
            </Command.List>

            <div className="flex items-center justify-between border-t border-[var(--line-color)] px-4 py-2 text-[11px] text-[var(--text-muted)]">
              <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
              <span className="font-mono">{shortcutLabel}</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
