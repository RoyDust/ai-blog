import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import type { PublicProfile } from "@/lib/public-profile-data";

interface AppShellProps {
  children: ReactNode;
  profile?: PublicProfile;
}

export function AppShell({ children, profile }: AppShellProps) {
  return (
    <div className="reader-shell flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--foreground)] transition-colors">
      <a
        href="#main-content"
        className="reader-panel sr-only z-[60] rounded-full px-4 py-2 text-sm font-semibold text-[var(--foreground)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要内容
      </a>
      <Navbar />
      <div className="flex flex-1 flex-col">
        <div className="relative z-10 mx-auto flex w-full max-w-[var(--page-width)] flex-1 flex-col gap-6 px-4 pb-8 pt-[clamp(2.5rem,4vw,4.25rem)] xl:flex-row xl:gap-[var(--layout-rail-gap)]">
          <div data-testid="sidebar-rail" className="hidden xl:block xl:w-[var(--rail-width)] xl:shrink-0">
            <Sidebar profile={profile} />
          </div>
          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-[var(--section-gap)]">
              {children}
            </div>
          </main>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[var(--page-width)] px-4 pb-8">
          <Footer />
        </div>
      </div>
    </div>
  );
}
