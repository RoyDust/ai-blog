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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <AdminSider pathname={pathname} userLabel={userLabel} />
        <div className="min-w-0">
          <AdminHeader currentLabel={meta.currentLabel} groupLabel={meta.currentGroup} />
          <main className="px-4 py-4 lg:px-6 lg:py-5">
            <AdminBreadcrumbs items={meta.crumbs} />
            <div className="mt-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
