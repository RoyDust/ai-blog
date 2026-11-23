"use client";

import {
  FileText,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Search,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import { adminNavItems } from "@/components/admin/shell/config";
import {
  Command,
  CommandDialog,
  CommandDialogClose,
  CommandDialogDescription,
  CommandDialogPopup,
  CommandDialogTitle,
  CommandDialogTrigger,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/coss/ui/command";
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
  icon: LucideIcon;
  keywords: string[];
};

const staticNavigationItems: NavigationSearchItem[] = [
  { id: "new-post", title: "新建文章", subtitle: "内容队列", href: "/admin/posts/new", icon: PenLine, keywords: ["write", "create", "post"] },
  { id: "settings", title: "设置", subtitle: "账号", href: "/admin/settings", icon: Settings, keywords: ["settings", "profile"] },
];

const navigationItems: NavigationSearchItem[] = [
  ...staticNavigationItems,
  ...adminNavItems.map((item) => ({
    id: item.href,
    title: item.label,
    subtitle: item.group,
    href: item.href,
    icon: item.icon || LayoutDashboard,
    keywords: [item.group, item.href],
  })),
];

const remoteGroupMeta: Record<keyof AdminSearchRemoteResults, { label: string; icon: LucideIcon }> = {
  posts: { label: "文章", icon: FileText },
  comments: { label: "评论", icon: MessageSquare },
};

function matchesNavigationItem(item: NavigationSearchItem, query: string) {
  if (!query) return true;

  const searchable = [item.title, item.subtitle, item.href, ...item.keywords].join(" ").toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function countRemoteResults(results: AdminSearchRemoteResults) {
  return results.posts.length + results.comments.length;
}

function SearchItem({
  icon: Icon,
  title,
  subtitle,
  href,
  badge,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  onSelect: (href: string) => void;
}) {
  return (
    <CommandItem
      value={`${title} ${subtitle} ${href}`}
      onClick={() => onSelect(href)}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors data-highlighted:bg-[var(--surface-alt)]"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-[var(--brand)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{subtitle}</span>
      </span>
      {badge ? <span className="shrink-0 rounded-full bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--muted)]">{badge}</span> : null}
    </CommandItem>
  );
}

function SearchGroup({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <CommandGroup className="px-2 py-2 text-[var(--foreground)]">
      <CommandGroupLabel className="px-2 pb-2 text-xs font-semibold text-[var(--muted)]">
        {heading}
      </CommandGroupLabel>
      <div className="space-y-1">{children}</div>
    </CommandGroup>
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
    typeof window !== "undefined" && /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ? "⌘K" : "Ctrl K";
  if (detectedShortcutLabel !== shortcutLabel) {
    setShortcutLabel(detectedShortcutLabel);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => {
          const next = !current;
          if (!next) {
            setQuery("");
          }
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleDialogOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }

  function selectHref(href: string) {
    handleDialogOpenChange(false);
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
            icon={meta.icon}
            title={item.title}
            subtitle={item.subtitle}
            href={item.href}
            badge={item.badge}
            onSelect={selectHref}
          />
        ))}
      </SearchGroup>
    );
  }

  return (
    <CommandDialog open={open} onOpenChange={handleDialogOpenChange}>
      <CommandDialogTrigger
        render={
          <button
            type="button"
            aria-label="打开后台全局搜索"
            className="ui-ring relative h-8 min-w-0 flex-1 rounded-[var(--radius-control)] bg-[var(--surface-alt)] pl-8 pr-3 text-left text-xs text-[var(--muted)] outline-none transition-colors hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:pl-9 sm:pr-14 lg:w-64 lg:flex-none lg:max-w-[360px]"
          />
        }
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
        <span className="block truncate">搜索文章、评论、功能...</span>
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--muted)] sm:block">
          {shortcutLabel}
        </kbd>
      </CommandDialogTrigger>

      <CommandDialogPopup className="admin-theme max-h-[min(78vh,44rem)] max-w-2xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-0 shadow-2xl before:hidden">
        <CommandDialogTitle className="sr-only">后台全局搜索</CommandDialogTitle>
        <CommandDialogDescription className="sr-only">搜索后台功能入口、文章和评论。</CommandDialogDescription>

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
          <div className="flex items-center gap-2 border-b border-[var(--border)] pr-3">
            <div className="min-w-0 flex-1">
              <CommandInput
                aria-label="搜索后台"
                placeholder="搜索文章、评论、功能..."
                className="text-sm text-[var(--foreground)]"
              />
            </div>
            <CommandDialogClose className="ui-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">关闭搜索</span>
            </CommandDialogClose>
          </div>

          <CommandList className="min-h-[18rem] max-h-[min(64vh,36rem)] p-2">
            {navigationResults.length > 0 ? (
              <SearchGroup heading={normalizedQuery ? "功能入口" : "常用入口"}>
                {navigationResults.map((item) => (
                  <SearchItem
                    key={item.id}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    href={item.href}
                    onSelect={selectHref}
                  />
                ))}
              </SearchGroup>
            ) : null}

            {renderRemoteGroup("posts", remoteResults.posts)}
            {renderRemoteGroup("comments", remoteResults.comments)}

            {loading ? <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">搜索中...</div> : null}
            {searchErrorMessage ? <div className="px-4 py-6 text-center text-sm text-rose-600">{searchErrorMessage}</div> : null}
            {showEmptyState ? <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">没有匹配结果</div> : null}
          </CommandList>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
