import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/layout/BrandMark";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "账号入口",
  description: "登录或注册账号以进入个人与后台功能。",
  path: "/register",
});

/**
 * 账号页布局（原型 12 第 4 张）：不走 AppShell，页面底色上居中一张 28rem 纸面，
 * 纸面上方是回首页的站点字标链接。纸面 card-bg + 1px --reader-border-strong + 6px 圆角，无投影。
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { siteName } = await getBlogSettings();

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--page-bg)] px-3 pb-12 pt-6 text-[var(--text-body)] sm:px-4 sm:pt-[clamp(3rem,9vh,4.5rem)]">
      <div className="w-full max-w-[28rem]">
        <Link
          href="/"
          className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-ctl)] text-[0.9375rem] font-bold text-[var(--foreground)] sm:mb-4"
        >
          <BrandMark siteName={siteName} size={28} />
          <span>{siteName}</span>
        </Link>
        <main
          id="main-content"
          className="animate-[fade-in-up_460ms_cubic-bezier(0.16,1,0.3,1)_both] rounded-[var(--radius-paper)] border border-[var(--reader-border-strong)] bg-[var(--card-bg)] px-4 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
