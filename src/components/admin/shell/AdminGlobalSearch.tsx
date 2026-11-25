"use client";

import {
  CornerDownLeft,
  FileText,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import { adminNavItems } from "@/components/admin/shell/config";
import {
  Command,
  CommandDialog,
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
      className="group/cmd flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors data-highlighted:bg-[var(--btn-regular-bg)]"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)] transition-colors group-data-highlighted/cmd:border-[color:color-mix(in_oklab,var(--brand)_24%,transparent)] group-data-highlighted/cmd:bg-[var(--surface)] group-data-highlighted/cmd:text-[var(--brand)] group-data-highlighted/cmd:shadow-2xs">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--foreground)] group-data-highlighted/cmd:font-semibold group-data-highlighted/cmd:text-[var(--btn-content)]">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{subtitle}</span>
      </span>
      {badge ? (
        <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
          {badge}
        </span>
      ) : (
        <CornerDownLeft
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-[var(--btn-content)] opacity-0 transition-opacity group-data-highlighted/cmd:opacity-70"
        />
      )}
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
    <CommandGroup className="px-1.5 py-1 text-[var(--foreground)]">
      <CommandGroupLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--text-faint)]">
        {heading}
      </CommandGroupLabel>
      <div className="space-y-0.5">{children}</div>
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

      <CommandDialogPopup className="admin-theme max-h-[min(78vh,42rem)] max-w-[36rem] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 shadow-[var(--shadow-ambient)] before:hidden">
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
          <div className="border-b border-[var(--border)] px-1.5 py-0.5">
            <CommandInput
              aria-label="搜索后台"
              placeholder="搜索文章、评论、功能..."
              startAddon={
                loading ? (
                  <Loader2 className="size-4 animate-spin text-[var(--brand)]" />
                ) : (
                  <Search className="size-4 text-[var(--muted)]" />
                )
              }
              className="text-[15px] text-[var(--foreground)] [&_input]:h-10 [&_input]:leading-10 [&_input]:placeholder:text-[var(--text-faint)]"
            />
          </div>

          <CommandList className="min-h-[16rem] max-h-[min(60vh,32rem)] px-1.5 py-1.5">
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

            {loading && remoteResultCount === 0 ? <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">搜索中...</div> : null}
            {searchErrorMessage ? <div className="px-4 py-6 text-center text-xs text-[var(--danger-foreground)]">{searchErrorMessage}</div> : null}
            {showEmptyState ? <div className="px-4 py-6 text-center text-xs text-[var(--muted)]">没有匹配结果</div> : null}
          </CommandList>

          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_48%,transparent)] px-4 py-2.5 text-[11px] text-[var(--muted)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs">↑</kbd>
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs">↓</kbd>
                <span className="ml-0.5">选择</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs">↵</kbd>
                <span className="ml-0.5">打开</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs">Esc</kbd>
                <span className="ml-0.5">关闭</span>
              </span>
            </div>
            <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 font-mono text-[10px] font-medium leading-none text-[var(--text-body)] shadow-2xs">{shortcutLabel}</kbd>
          </div>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
}
