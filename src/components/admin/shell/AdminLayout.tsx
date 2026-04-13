"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AdminHeader } from "./AdminHeader";
import { AdminSider } from "./AdminSider";
import { getAdminPathMeta } from "./config";

interface AdminLayoutProps {
  children: ReactNode;
  userLabel: string;
}

export function AdminLayout({ children, userLabel }: AdminLayoutProps) {
  const pathname = usePathname();
  const meta = getAdminPathMeta(pathname);

  return (
    <div className="admin-theme h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] antialiased">
      <div className="grid h-screen lg:grid-cols-[280px_minmax(0,1fr)]" data-layout-sidebar-width="280" data-testid="admin-layout-grid">
        <AdminSider pathname={pathname} userLabel={userLabel} />
        <div className="min-w-0 h-screen overflow-hidden flex flex-col" data-testid="admin-layout-content">
          <AdminHeader currentLabel={meta.currentLabel} groupLabel={meta.currentGroup} />
          <main className="mx-auto flex-1 w-full max-w-[1600px] overflow-y-auto px-4 py-5 lg:px-6 lg:py-6" data-content-max-width="1600" data-testid="admin-layout-main">
            <div className="space-y-4">
              <AdminBreadcrumbs items={meta.crumbs} />
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
