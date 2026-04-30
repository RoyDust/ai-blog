import Link from "next/link";
import { Bell, ChevronDown, PenLine, Search, UserCircle } from "lucide-react";

interface AdminHeaderProps {
  groupLabel: string;
  currentLabel: string;
  userLabel: string;
}

export function AdminHeader({ userLabel }: AdminHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 lg:px-7">
      <div className="flex min-h-11 w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative min-w-0 flex-1 lg:max-w-[420px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            aria-label="后台静态搜索"
            className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-12 pr-14 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--ring)]"
            placeholder="搜索文章、页面、评论..."
            type="search"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--muted)] sm:block">
            ⌘K
          </kbd>
        </label>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(35,135,95,0.18)] transition-colors hover:bg-[var(--brand-strong)]"
            href="/admin/posts/new"
          >
            <PenLine className="h-4 w-4" />
            新建文章
          </Link>

          <button
            aria-label="通知功能稍后开放"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-90"
            disabled
            type="button"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--surface)]" />
          </button>

          <div className="hidden min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--foreground)] md:flex">
            <UserCircle className="h-7 w-7 text-[var(--muted)]" />
            <span className="max-w-24 truncate">{userLabel}</span>
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          </div>
        </div>
      </div>
    </header>
  );
}
