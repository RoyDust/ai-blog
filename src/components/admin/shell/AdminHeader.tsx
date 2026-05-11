import Link from "next/link";
import { PenLine } from "lucide-react";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";

export function AdminHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-4 lg:px-7">
      <div className="flex min-h-11 w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <AdminGlobalSearch />

        <div className="flex shrink-0 items-center gap-3">
          <Link
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(35,135,95,0.18)] transition-colors hover:bg-[var(--brand-strong)]"
            href="/admin/posts/new"
          >
            <PenLine className="h-4 w-4" />
            新建文章
          </Link>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
