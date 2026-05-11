"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminHeader } from "./AdminHeader";
import { AdminSider } from "./AdminSider";

interface AdminLayoutProps {
  children: ReactNode;
  siteName?: string;
  user: {
    email?: string | null;
    image?: string | null;
    label: string;
    role?: string | null;
  };
}

// Keep this fallback aligned with DEFAULT_BLOG_SETTINGS without importing server-only settings code.
export function AdminLayout({ children, siteName = "My Blog", user }: AdminLayoutProps) {
  const pathname = usePathname();
  const isPostEditorRoute = /^\/admin\/posts\/(?:new|[^/]+\/edit)\/?$/.test(pathname);
  const rootClassName = isPostEditorRoute
    ? "admin-theme fixed inset-0 h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)] antialiased"
    : "admin-theme h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] antialiased";
  const gridClassName = isPostEditorRoute
    ? "grid h-full min-h-0 overflow-hidden lg:grid-cols-[224px_minmax(0,1fr)]"
    : "grid h-screen lg:grid-cols-[224px_minmax(0,1fr)]";
  const layoutContentClassName = isPostEditorRoute
    ? "min-w-0 flex h-full min-h-0 flex-col overflow-hidden"
    : "min-w-0 h-screen overflow-hidden flex flex-col";
  const mainClassName = isPostEditorRoute
    ? "flex-1 min-h-0 w-full overflow-hidden px-4 py-5 lg:px-6 lg:py-6 2xl:px-8 2xl:py-7"
    : "flex-1 w-full overflow-y-auto px-4 py-5 lg:px-6 lg:py-6 2xl:px-8 2xl:py-7";
  const contentClassName = isPostEditorRoute
    ? "mx-auto h-full min-h-0 w-full max-w-[1840px]"
    : "mx-auto w-full max-w-[1840px]";

  return (
    <div className={rootClassName}>
      <div className={gridClassName} data-layout-sidebar-width="224" data-testid="admin-layout-grid">
        <AdminSider pathname={pathname} siteName={siteName} user={user} />
        <div className={layoutContentClassName} data-testid="admin-layout-content">
          <AdminHeader />
          <main className={mainClassName} data-content-max-width="full" data-testid="admin-layout-main">
            <div className={contentClassName}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
