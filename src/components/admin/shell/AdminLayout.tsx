"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
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
      <div className="grid h-screen lg:grid-cols-[224px_minmax(0,1fr)]" data-layout-sidebar-width="224" data-testid="admin-layout-grid">
        <AdminSider pathname={pathname} userLabel={userLabel} />
        <div className="min-w-0 h-screen overflow-hidden flex flex-col" data-testid="admin-layout-content">
          <AdminHeader currentLabel={meta.currentLabel} groupLabel={meta.currentGroup} userLabel={userLabel} />
          <main className="flex-1 w-full overflow-y-auto px-4 py-5 lg:px-7 lg:py-7" data-content-max-width="full" data-testid="admin-layout-main">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
