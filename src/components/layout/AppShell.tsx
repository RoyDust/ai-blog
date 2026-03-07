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
        <div className="mx-auto flex w-full max-w-[var(--page-width)] flex-1 gap-4 pt-4 px-4">
          <aside className="hidden lg:block">
            <Sidebar />
          </aside>
          <main id="main-content" className="onload-animation min-w-0 flex-1">
            {children}
            <Footer />
          </main>
        </div>
      </div>
    </div>
  );
}
