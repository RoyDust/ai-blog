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
