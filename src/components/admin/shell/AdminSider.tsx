import Link from "next/link";
import { ChevronDown, Leaf, Sparkles } from "lucide-react";
import { adminNavItems, isAdminNavItemActive } from "./config";

interface AdminSiderProps {
  pathname: string;
  userLabel: string;
}

export function AdminSider({ pathname, userLabel }: AdminSiderProps) {
  const mainItems = adminNavItems.filter((item) => item.group === "主导航");
  const aiItems = adminNavItems.filter((item) => item.group === "AI 辅助");
  const isAiActive = pathname.startsWith("/admin/ai");

  return (
    <aside
      className="hidden sticky top-0 h-screen overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col"
      data-testid="admin-layout-sidebar"
    >
      <div className="px-5 pb-7 pt-6">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[var(--brand)]">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">roydust.top</span>
        </Link>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto border-t border-[var(--border)] px-3 py-6">
        <p className="px-2 pb-4 font-display text-lg font-semibold text-[var(--foreground)]">博客后台</p>
        <div className="space-y-2">
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = isAdminNavItemActive(pathname, item.href);
            const itemClassName = `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
              isActive
                ? "bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-alt))] text-[var(--brand)]"
                : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
            }`;

            if (item.disabled) {
              return (
                <button
                  key={item.href}
                  aria-label={`${item.label}稍后开放`}
                  className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-[var(--muted)] opacity-70"
                  disabled
                  type="button"
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={itemClassName}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold text-amber-700">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="space-y-5 border-t border-[var(--border)] px-5 py-5">
        <div
          className={`flex items-center justify-between rounded-lg px-1 py-2 text-sm font-medium ${
            isAiActive ? "text-[var(--brand)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="inline-flex items-center gap-3">
            <Sparkles className="h-5 w-5" />
            AI 助手
          </span>
          <ChevronDown className={`h-4 w-4 ${isAiActive ? "" : "-rotate-90"}`} />
        </div>
        <div className="space-y-1 pl-8">
          {aiItems.map((item) => {
            const isActive = isAdminNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                  isActive ? "bg-emerald-50 font-medium text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label === "AI 模型" ? "模型配置" : item.label}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-[var(--border)] pt-5">
          <div className="flex items-center gap-3 rounded-lg py-1">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-alt)] text-base font-semibold text-[var(--foreground)]">
              {userLabel.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-[var(--foreground)]">{userLabel}</p>
              <p className="text-sm text-[var(--muted)]">管理员</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          </div>
        </div>
      </div>
    </aside>
  );
}
