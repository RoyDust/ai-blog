"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminHeader } from "./AdminHeader";
import { AdminSider } from "./AdminSider";

interface AdminLayoutProps {
  children: ReactNode;
  user: {
    email?: string | null;
    image?: string | null;
    label: string;
    role?: string | null;
  };
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="admin-theme h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] antialiased">
      <div className="grid h-screen lg:grid-cols-[224px_minmax(0,1fr)]" data-layout-sidebar-width="224" data-testid="admin-layout-grid">
        <AdminSider pathname={pathname} user={user} />
        <div className="min-w-0 h-screen overflow-hidden flex flex-col" data-testid="admin-layout-content">
          <AdminHeader />
          <main className="flex-1 w-full overflow-y-auto px-4 py-5 lg:px-6 lg:py-6 2xl:px-8 2xl:py-7" data-content-max-width="full" data-testid="admin-layout-main">
            <div className="mx-auto w-full max-w-[1840px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
