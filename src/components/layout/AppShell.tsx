import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import { PageTransition } from "./PageTransition";
import type { PublicProfile } from "@/lib/public-profile-data";
import type { UserReadingStats } from "@/lib/reading-stats";

interface AppShellProps {
  children: ReactNode;
  profile?: PublicProfile;
  readingStats?: UserReadingStats | null;
  siteDescription?: string;
  siteName?: string;
}

/**
 * 前台外壳（方向 A，简报 15.2 / 16.1）：背景图 + 一张实底纸面。
 *
 * 纸面包住侧栏、主列和页脚；侧栏与主列之间一条 1px 竖线，页脚在纸面最底部、上方 1px 细线。
 * 侧栏只在 xl 及以上出现；文章详情页由页面自己再加目录栏。
 */
export function AppShell({ children, profile, readingStats, siteDescription, siteName }: AppShellProps) {
  return (
    <div className="reader-shell flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--foreground)] transition-colors">
      <a
        href="#main-content"
        className="ed-btn sr-only z-[60] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        跳到主要内容
      </a>
      <Navbar siteName={siteName} />
      <div className="flex flex-1 flex-col">
        <div className="reader-layout-frame relative z-10 mx-auto flex w-full max-w-[var(--page-width)] flex-1 flex-col px-3 pb-8 pt-[var(--reader-page-top)] sm:px-4">
          <div className="ed-paper reader-paper flex flex-1 flex-col">
            <div className="flex flex-1 flex-col xl:flex-row">
              <div
                data-testid="sidebar-rail"
                className="reader-side-rail hidden xl:block xl:w-[var(--rail-width)] xl:shrink-0 xl:border-r xl:border-[var(--border)] xl:pr-6"
              >
                <Sidebar profile={profile} readingStats={readingStats} />
              </div>
              <main id="main-content" className="min-w-0 flex-1 xl:pl-6">
                <PageTransition>
                  <div className="reader-content-frame mx-auto w-full max-w-[var(--content-max-width)] space-y-[var(--section-gap)]">
                    {children}
                  </div>
                </PageTransition>
              </main>
            </div>
            <Footer siteDescription={siteDescription} siteName={siteName} />
          </div>
        </div>
      </div>
    </div>
  );
}
