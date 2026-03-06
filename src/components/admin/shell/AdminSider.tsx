import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { adminNavItems } from "./config";

interface AdminSiderProps {
  pathname: string;
  userLabel: string;
}

export function AdminSider({ pathname, userLabel }: AdminSiderProps) {
  const groups = Array.from(new Set(adminNavItems.map((item) => item.group)));

  return (
    <aside className="hidden border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:min-h-screen lg:flex-col">
      <div className="border-b border-[var(--border)] px-5 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Admin Pro Lite</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[var(--foreground)]">My Blog Admin</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">面向内容与互动治理的统一工作台。</p>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 space-y-6 px-4 py-6">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{group}</p>
            <div className="mt-2 space-y-1">
              {adminNavItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        isActive
                          ? "flex items-center gap-3 rounded-2xl bg-[var(--brand)] px-3 py-2.5 text-sm font-medium text-white shadow-[0_16px_30px_-22px_rgba(15,118,110,0.85)]"
                          : "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
                      }
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
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
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
