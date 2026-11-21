"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import { adminNavItems } from "@/components/admin/shell/config";
import { apiFetcher, toErrorMessage } from "@/lib/client-api";
import {
  ADMIN_SEARCH_MIN_QUERY_LENGTH,
  EMPTY_ADMIN_SEARCH_REMOTE_RESULTS,
  normalizeAdminSearchQuery,
  type AdminSearchRemoteResults,
  type AdminSearchResponse,
  type AdminSearchResult,
} from "@/lib/admin-search";

type NavigationSearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  keywords: string[];
};

const staticNavigationItems: NavigationSearchItem[] = [
  { id: "new-post", title: "新建文章", subtitle: "内容队列", href: "/admin/posts/new", keywords: ["write", "create", "post"] },
  { id: "settings", title: "设置", subtitle: "账号", href: "/admin/settings", keywords: ["settings", "profile"] },
];

const navigationItems: NavigationSearchItem[] = [
  ...staticNavigationItems,
  ...adminNavItems.map((item) => ({
    id: item.href,
    title: item.label,
    subtitle: item.group,
    href: item.href,
    keywords: [item.group, item.href],
  })),
];

const remoteGroupMeta: Record<keyof AdminSearchRemoteResults, { label: string }> = {
  posts: { label: "文章" },
  comments: { label: "评论" },
};

function matchesNavigationItem(item: NavigationSearchItem, query: string) {
  if (!query) return true;

  const searchable = [item.title, item.subtitle, item.href, ...item.keywords].join(" ").toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function countRemoteResults(results: AdminSearchRemoteResults) {
  return results.posts.length + results.comments.length;
}

/**
 * 结果行（状态画板 D1）：去掉左侧图标，「标题 …… 类型 / 状态」两端对齐；
 * 键盘选中项 foreground 5% 底 + 左 2px sky 竖线，并在行尾显示等宽 ↵。
 */
function SearchItem({
  title,
  meta,
  href,
  onSelect,
}: {
  title: string;
  meta: string;
  href: string;
  onSelect: (href: string) => void;
}) {
  return (
    <Command.Item
      value={`${title} ${meta} ${href}`}
      onSelect={() => onSelect(href)}
      className="group/item flex h-10 cursor-pointer items-center gap-3 rounded-[2px] px-3 text-left text-[0.875rem] text-[var(--foreground)] outline-none transition-colors duration-100 data-[selected=true]:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] data-[selected=true]:shadow-[inset_2px_0_0_var(--accent-sky)]"
    >
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {meta ? <span className="max-w-[45%] shrink-0 truncate text-xs text-[var(--text-muted)]">{meta}</span> : null}
      <span aria-hidden="true" className="hidden font-mono text-[11px] text-[var(--text-muted)] group-data-[selected=true]/item:inline">
        ↵
      </span>
    </Command.Item>
  );
}

/** 分组标题：同侧栏组标题写法（.75rem 700 字距 .08em muted） */
function SearchGroup({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-[var(--text-muted)]"
    >
      {children}
    </Command.Group>
  );
}

function SearchStateLine({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <p className={tone === "danger" ? "px-3 py-3 text-[0.8125rem] text-[var(--danger-foreground)]" : "px-3 py-3 text-[0.8125rem] text-[var(--text-muted)]"} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function AdminGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  // useDeferredValue 提供可中断的输入延迟，替代手写 180ms 防抖
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeAdminSearchQuery(deferredQuery);
  const shouldFetchRemote = open && normalizedQuery.length >= ADMIN_SEARCH_MIN_QUERY_LENGTH;

  const {
    data: searchResponse,
    error: searchError,
    isLoading: searchLoading,
  } = useSWR<AdminSearchResponse>(
    shouldFetchRemote ? `/api/admin/search?q=${encodeURIComponent(normalizedQuery)}` : null,
    apiFetcher,
    { keepPreviousData: true },
  );

  const remoteResults: AdminSearchRemoteResults = searchResponse?.data.results ?? EMPTY_ADMIN_SEARCH_REMOTE_RESULTS;
  const loading = shouldFetchRemote && searchLoading;
  const searchErrorMessage = searchError ? toErrorMessage(searchError, "搜索暂时不可用") : null;

  const navigationResults = useMemo(
    () => navigationItems.filter((item) => matchesNavigationItem(item, normalizedQuery)).slice(0, normalizedQuery ? 8 : 6),
    [normalizedQuery],
  );
  const remoteResultCount = countRemoteResults(remoteResults);
  const showEmptyState = normalizedQuery.length >= ADMIN_SEARCH_MIN_QUERY_LENGTH && navigationResults.length === 0 && remoteResultCount === 0 && !loading;

  // 渲染期条件调整：SSR/首帧输出 "Ctrl K" 与 hydration 一致，客户端随后切换到平台专属快捷键
  const detectedShortcutLabel =
    typeof window !== "undefined" && /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? "⌘ K" : "Ctrl K";
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

  function selectHref(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function renderRemoteGroup(group: keyof AdminSearchRemoteResults, items: AdminSearchResult[]) {
    if (items.length === 0) return null;

    const meta = remoteGroupMeta[group];

    return (
      <SearchGroup heading={meta.label} key={group}>
        {items.map((item) => (
          <SearchItem
            key={`${group}-${item.id}`}
            title={item.title}
            meta={[item.subtitle, item.badge].filter(Boolean).join(" · ")}
            href={item.href}
            onSelect={selectHref}
          />
        ))}
      </SearchGroup>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="打开后台全局搜索"
          className="flex h-9 w-[clamp(11rem,22vw,18.75rem)] min-w-0 cursor-pointer items-center gap-2 rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-1.5 pl-2.5 text-left text-[0.8125rem] text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--text-muted)] aria-expanded:border-[var(--foreground)]"
        >
          <Search className="size-[15px] shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">搜索文章、评论、功能...</span>
          <kbd className="pointer-events-none hidden shrink-0 rounded-[2px] border border-[var(--reader-border-strong)] px-[5px] py-1 font-mono text-[11px] leading-none text-[var(--text-muted)] sm:block">
            {shortcutLabel}
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--foreground)_30%,transparent)] transition-opacity duration-200 ease-out starting:opacity-0 motion-reduce:transition-none dark:bg-black/60" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-paper)] border border-[var(--reader-border-strong)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-none transition-[opacity,translate] duration-200 ease-out focus:outline-none starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none">
          <Dialog.Title className="sr-only">后台全局搜索</Dialog.Title>
          <Dialog.Description className="sr-only">搜索后台功能入口、文章和评论。</Dialog.Description>
          <Command shouldFilter={false} loop className="flex max-h-[min(78vh,44rem)] flex-col">
            <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-[var(--border)] pr-2.5 pl-4 text-[var(--text-muted)]">
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <Command.Input
                autoFocus
                aria-label="搜索后台"
                value={query}
                onValueChange={setQuery}
                placeholder="搜索文章、评论、功能..."
                className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus-visible:outline-none"
              />
              <kbd aria-hidden="true" className="hidden rounded-[2px] border border-[var(--reader-border-strong)] px-[5px] py-[3px] font-mono text-[11px] leading-none sm:block">
                Esc
              </kbd>
              <Dialog.Close className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-ctl)] text-[var(--text-body)] transition-colors hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)]">
                <X className="size-[15px]" aria-hidden="true" />
                <span className="sr-only">关闭搜索</span>
              </Dialog.Close>
            </div>

            <Command.List className="min-h-[14rem] overflow-y-auto px-1.5 pt-1 pb-2">
              {navigationResults.length > 0 ? (
                <SearchGroup heading={normalizedQuery ? "功能入口" : "常用入口"}>
                  {navigationResults.map((item) => (
                    <SearchItem key={item.id} title={item.title} meta={item.subtitle} href={item.href} onSelect={selectHref} />
                  ))}
                </SearchGroup>
              ) : null}

              {renderRemoteGroup("posts", remoteResults.posts)}
              {renderRemoteGroup("comments", remoteResults.comments)}

              {loading ? <SearchStateLine>搜索中...</SearchStateLine> : null}
              {searchErrorMessage ? <SearchStateLine tone="danger">{searchErrorMessage}</SearchStateLine> : null}
              {showEmptyState ? <SearchStateLine>没有匹配结果</SearchStateLine> : null}
            </Command.List>

            <div aria-hidden="true" className="flex shrink-0 gap-4 border-t border-[var(--border)] px-4 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
              <span>↑↓ 选择</span>
              <span>↵ 打开</span>
              <span>Esc 关闭</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
