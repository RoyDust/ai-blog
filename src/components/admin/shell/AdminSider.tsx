import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { adminNavItems, isAdminNavItemActive } from "./config";

interface AdminSiderProps {
  pathname: string;
  userLabel: string;
}

export function AdminSider({ pathname, userLabel }: AdminSiderProps) {
  const groups = Array.from(new Set(adminNavItems.map((item) => item.group)));

  return (
    <aside
      className="hidden sticky top-0 h-screen overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col"
      data-testid="admin-layout-sidebar"
    >
      <div className="px-5 py-6">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">编辑工作台</p>
        <p className="mt-2 font-display text-3xl font-semibold text-[var(--foreground)]">内容工作室</p>
        <p className="mt-2 text-sm text-[var(--muted)]">清新、温润、聚焦内容节奏。</p>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto space-y-6 px-4 pb-6">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{group}</p>
            <div className="mt-2 space-y-1">
              {adminNavItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = isAdminNavItemActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[var(--surface-alt)] text-[var(--brand)] shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--border)] px-4 py-4">
        <div className="rounded-2xl bg-[var(--surface-alt)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">当前账号</p>
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{userLabel}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link className="inline-flex items-center gap-2 text-[var(--brand)] hover:underline" href="/">
              <ArrowLeft className="h-4 w-4" />
              返回站点
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
