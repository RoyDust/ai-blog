"use client";

import {
  Archive,
  ArrowRight,
  Bookmark,
  BookOpenText,
  Compass,
  CornerDownLeft,
  FileText,
  Home,
  ListTree,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import {
  Command,
  CommandDialog,
  CommandDialogDescription,
  CommandDialogPopup,
  CommandDialogTitle,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/coss/ui/command";
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
  { id: "guides", title: "专题导读", subtitle: "按知识路线系统学习核心主题", href: "/guides", icon: Compass, keywords: ["guides", "roadmap", "topic"] },
  { id: "archives", title: "时间归档", subtitle: "按年份回溯历史文章时间线", href: "/archives", icon: Archive, keywords: ["archives", "timeline"] },
  { id: "bookmarks", title: "本地书签", subtitle: "查看收藏过的待读文章", href: "/bookmarks", icon: Bookmark, keywords: ["bookmarks", "saved"] },
  { id: "about", title: "关于作者", subtitle: "了解站点背景与联系方式", href: "/about", icon: UserRound, keywords: ["about", "author", "profile"] },
];

const commandItemBaseClassName =
  "group/cmd flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors data-highlighted:bg-[var(--btn-regular-bg)]";

const commandIconBadgeClassName =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_65%,var(--card-bg)_35%)] text-[var(--text-muted)] transition-colors group-data-highlighted/cmd:border-[color:color-mix(in_oklab,var(--brand)_22%,transparent)] group-data-highlighted/cmd:bg-[var(--card-bg)] group-data-highlighted/cmd:text-[var(--brand)] group-data-highlighted/cmd:shadow-2xs";

const footerKbdClassName =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--reader-border)] bg-[var(--card-bg)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs";

function CommandGroupBlock({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <CommandGroup className="px-1.5 py-1 text-[var(--foreground)]">
      <CommandGroupLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--text-faint)]">
        {heading}
      </CommandGroupLabel>
      <div className="space-y-0.5">{children}</div>
    </CommandGroup>
  );
}

export interface PublicCommandSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcutLabel: string;
}

export function PublicCommandSearchDialog({
  open,
  onOpenChange,
  shortcutLabel,
}: PublicCommandSearchDialogProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");

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

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery("");
    }
    onOpenChange(nextOpen);
  }

  function navigateTo(href: string) {
    handleDialogOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={handleDialogOpenChange}>
      <CommandDialogPopup className="max-h-[min(78vh,39rem)] max-w-[34rem] overflow-hidden rounded-2xl border border-[var(--reader-border)] bg-[var(--float-panel-bg)] p-0 shadow-[var(--shadow-ambient)] backdrop-blur-xl before:hidden">
        <CommandDialogTitle className="sr-only">全站快速搜索与导航</CommandDialogTitle>
        <CommandDialogDescription className="sr-only">输入关键词即时检索文章，或快速跳转前台页面与切换主题。</CommandDialogDescription>

        <Command
          autoHighlight="always"
          filter={null}
          keepHighlight
          loopFocus
          mode="none"
          value={query}
          onValueChange={(nextValue, eventDetails) => {
            if (eventDetails.reason === "item-press") return;
            setQuery(nextValue);
          }}
        >
          <div className="border-b border-[var(--line-color)] px-1.5 py-0.5">
            <CommandInput
              aria-label="输入关键词搜索文章"
              placeholder="搜索文章标题、摘要，或直接跳转页面…"
              startAddon={
                loading ? (
                  <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
                ) : (
                  <Search className="size-4 text-[var(--text-muted)]" />
                )
              }
              className="text-[15px] text-[var(--foreground)] [&_input]:h-10 [&_input]:leading-10 [&_input]:placeholder:text-[var(--text-faint)]"
            />
          </div>

          <CommandList className="min-h-[13rem] max-h-[min(56vh,27rem)] px-1.5 py-1.5">
            {normalizedQuery ? (
              <CommandGroupBlock heading="全文检索">
                <CommandItem
                  value={`full-search-${normalizedQuery}`}
                  onClick={() => navigateTo(`/search?q=${encodeURIComponent(normalizedQuery)}`)}
                  className={commandItemBaseClassName}
                >
                  <span className={commandIconBadgeClassName}>
                    <Search className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--foreground)] group-data-highlighted/cmd:text-[var(--btn-content)]">
                    查看「{normalizedQuery}」的完整搜索与 AI 导读
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--brand)] opacity-60 transition-transform group-data-highlighted/cmd:translate-x-0.5 group-data-highlighted/cmd:opacity-100" aria-hidden="true" />
                </CommandItem>
              </CommandGroupBlock>
            ) : null}

            {posts.length > 0 ? (
              <CommandGroupBlock heading={`匹配文章 (${totalMatches})`}>
                {posts.map((post) => (
                  <CommandItem
                    key={post.id}
                    value={`post-${post.slug}-${post.title}`}
                    onClick={() => navigateTo(`/posts/${post.slug}`)}
                    className={commandItemBaseClassName}
                  >
                    <span className={commandIconBadgeClassName}>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--foreground)] group-data-highlighted/cmd:font-semibold group-data-highlighted/cmd:text-[var(--btn-content)]">
                        {post.title}
                      </span>
                      {post.excerpt ? (
                        <span className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                          {post.excerpt}
                        </span>
                      ) : null}
                    </span>
                    {post.category?.name ? (
                      <span className="shrink-0 rounded-md border border-[var(--reader-border)] bg-[var(--card-bg)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                        #{post.category.name}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroupBlock>
            ) : null}

            {matchingQuickLinks.length > 0 ? (
              <CommandGroupBlock heading={normalizedQuery ? "相关入口" : "快速跳转"}>
                {matchingQuickLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`nav-${item.id}-${item.title}`}
                      onClick={() => navigateTo(item.href)}
                      className={commandItemBaseClassName}
                    >
                      <span className={commandIconBadgeClassName}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--foreground)] group-data-highlighted/cmd:font-semibold group-data-highlighted/cmd:text-[var(--btn-content)]">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                          {item.subtitle}
                        </span>
                      </span>
                      <CornerDownLeft
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--btn-content)] opacity-0 transition-opacity group-data-highlighted/cmd:opacity-70"
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroupBlock>
            ) : null}

            {!normalizedQuery ? (
              <CommandGroupBlock heading="阅读偏好">
                <CommandItem
                  value="toggle-reader-theme"
                  onClick={() => {
                    toggleTheme();
                    handleDialogOpenChange(false);
                  }}
                  className={commandItemBaseClassName}
                >
                  <span className={commandIconBadgeClassName}>
                    {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-[var(--foreground)] group-data-highlighted/cmd:font-semibold group-data-highlighted/cmd:text-[var(--btn-content)]">
                    {theme === "dark" ? "切换到日间阅读模式" : "切换到夜间阅读模式"}
                  </span>
                  <CornerDownLeft
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 text-[var(--btn-content)] opacity-0 transition-opacity group-data-highlighted/cmd:opacity-70"
                  />
                </CommandItem>
              </CommandGroupBlock>
            ) : null}

            {queryCharCount === 1 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                再输入至少 1 个字符即可即时预览匹配文章，或直接按回车前往搜索页
              </div>
            ) : null}
            {loading && posts.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">正在检索文章…</div>
            ) : null}
            {errorMessage ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--danger-foreground)]">{errorMessage}</div>
            ) : null}
            {queryCharCount >= 2 && !loading && !errorMessage && posts.length === 0 && matchingQuickLinks.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">未找到直接匹配的文章，可按回车尝试完整搜索</div>
            ) : null}
          </CommandList>

          <div className="flex items-center justify-between border-t border-[var(--line-color)] bg-[color:color-mix(in_oklab,var(--surface-alt)_42%,transparent)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className={footerKbdClassName}>↑</kbd>
                <kbd className={footerKbdClassName}>↓</kbd>
                <span className="ml-0.5">选择</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className={footerKbdClassName}>↵</kbd>
                <span className="ml-0.5">打开</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className={footerKbdClassName}>Esc</kbd>
                <span className="ml-0.5">关闭</span>
              </span>
            </div>
            <kbd className={footerKbdClassName}>{shortcutLabel}</kbd>
          </div>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
