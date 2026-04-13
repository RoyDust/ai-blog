import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)] transition-colors">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-[var(--primary)] px-3 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要内容
      </a>
      <Navbar />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[var(--page-width)] flex-1 gap-6 px-4 pb-8 pt-4 xl:gap-8">
          <main id="main-content" className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-[var(--section-gap)]">
              {children}
            </div>
          </main>
          <aside className="hidden xl:block xl:w-[var(--rail-width)] xl:shrink-0">
            <Sidebar />
          </aside>
        </div>
        <div className="mx-auto w-full max-w-[var(--page-width)] px-4 pb-8">
          <Footer />
        </div>
      </div>
    </div>
  );
}
