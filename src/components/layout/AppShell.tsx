import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Header />
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_280px] lg:px-6">
        <main>{children}</main>
        <aside className="hidden lg:block">
          <Sidebar />
        </aside>
      </div>
      <Footer />
    </div>
  );
}
