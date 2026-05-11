"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
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
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { adminNavItems } from "@/components/admin/shell/config";
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
    <Command.Item
      value={`${title} ${subtitle} ${href}`}
      onSelect={() => onSelect(href)}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors data-[selected=true]:bg-[var(--surface-alt)]"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[var(--brand)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{title}</span>
        <span className="block truncate text-xs text-[var(--muted)]">{subtitle}</span>
      </span>
      {badge ? <span className="shrink-0 rounded-full bg-[var(--surface-alt)] px-2 py-1 text-xs text-[var(--muted)]">{badge}</span> : null}
    </Command.Item>
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
    <Command.Group
      heading={heading}
      className="px-2 py-2 text-[var(--foreground)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-[var(--muted)]"
    >
      <div className="space-y-1">{children}</div>
    </Command.Group>
  );
}

export function AdminGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<AdminSearchRemoteResults>(EMPTY_ADMIN_SEARCH_REMOTE_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");

  const normalizedQuery = normalizeAdminSearchQuery(query);
  const navigationResults = useMemo(
    () => navigationItems.filter((item) => matchesNavigationItem(item, normalizedQuery)).slice(0, normalizedQuery ? 8 : 6),
    [normalizedQuery],
  );
  const remoteResultCount = countRemoteResults(remoteResults);
  const showEmptyState = normalizedQuery.length >= ADMIN_SEARCH_MIN_QUERY_LENGTH && navigationResults.length === 0 && remoteResultCount === 0 && !loading;

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(window.navigator.platform);
    setShortcutLabel(isMac ? "⌘K" : "Ctrl K");
  }, []);

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

  useEffect(() => {
    if (!open || normalizedQuery.length < ADMIN_SEARCH_MIN_QUERY_LENGTH) {
      setRemoteResults(EMPTY_ADMIN_SEARCH_REMOTE_RESULTS);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const payload = (await response.json()) as AdminSearchResponse;
        setRemoteResults(payload.data.results);
      } catch (searchError) {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setRemoteResults(EMPTY_ADMIN_SEARCH_REMOTE_RESULTS);
        setError("搜索暂时不可用");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, normalizedQuery]);

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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="打开后台全局搜索"
          className="ui-ring relative h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-12 pr-16 text-left text-sm text-[var(--muted)] outline-none transition-colors hover:border-[var(--brand)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] lg:max-w-[420px]"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
          <span className="block truncate">搜索文章、评论、功能...</span>
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] sm:block">
            {shortcutLabel}
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">后台全局搜索</Dialog.Title>
          <Dialog.Description className="sr-only">搜索后台功能入口、文章和评论。</Dialog.Description>
          <Command shouldFilter={false} loop className="flex max-h-[min(78vh,44rem)] flex-col">
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <Search className="h-5 w-5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
              <Command.Input
                autoFocus
                aria-label="搜索后台"
                value={query}
                onValueChange={setQuery}
                placeholder="搜索文章、评论、功能..."
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              />
              <Dialog.Close className="ui-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">关闭搜索</span>
              </Dialog.Close>
            </div>

            <Command.List className="min-h-[18rem] overflow-y-auto p-2">
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
              {error ? <div className="px-4 py-6 text-center text-sm text-rose-600">{error}</div> : null}
              {showEmptyState ? <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">没有匹配结果</div> : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
