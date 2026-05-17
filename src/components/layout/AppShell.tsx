import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import type { PublicProfile } from "@/lib/public-profile-data";
import type { UserReadingStats } from "@/lib/reading-stats";

interface AppShellProps {
  children: ReactNode;
  profile?: PublicProfile;
  readingStats?: UserReadingStats | null;
  siteDescription?: string;
  siteName?: string;
}

export function AppShell({ children, profile, readingStats, siteDescription, siteName }: AppShellProps) {
  return (
    <div className="reader-shell flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--foreground)] transition-colors">
      <a
        href="#main-content"
        className="reader-panel sr-only z-[60] rounded-full px-4 py-2 text-sm font-semibold text-[var(--foreground)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要内容
      </a>
      <Navbar siteName={siteName} />
      <div className="flex flex-1 flex-col">
        <div className="relative z-10 mx-auto flex w-full max-w-[var(--page-width)] flex-1 flex-col gap-6 px-4 pb-8 pt-[var(--reader-page-top)] xl:flex-row xl:gap-[var(--layout-rail-gap)]">
          <div data-testid="sidebar-rail" className="reader-side-rail hidden xl:block xl:w-[var(--rail-width)] xl:shrink-0">
            <Sidebar profile={profile} readingStats={readingStats} />
          </div>
          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-[var(--section-gap)]">
              {children}
            </div>
          </main>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[var(--page-width)] px-4 pb-8">
          <Footer siteDescription={siteDescription} siteName={siteName} />
        </div>
      </div>
    </div>
  );
}
