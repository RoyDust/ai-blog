import type { Metadata } from "next";

import { getBlogSettings } from "@/lib/blog-settings";
import { buildPageMetadata } from "@/lib/seo";
import { NewsletterConfirmClient } from "../NewsletterConfirmClient";

type VerifyPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return {
    ...buildPageMetadata({
      title: "确认邮件订阅",
      description: "确认邮箱地址以完成 Newsletter 订阅。",
      path: "/newsletter/verify",
      siteUrl: settings.siteUrl,
    }),
    robots: {
      index: false,
      follow: false,
    },
  };
}

const verifyNotes = [
  "验证链接自发送起 48 小时内有效；若已过期，可在首页或文章底部重新提交邮箱获取新链接。",
  "完成确认后，每封精选邮件底部与邮件头均附带一键退订入口，可随时取消订阅。",
];

export default async function NewsletterVerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  return (
    <div className="onload-animation space-y-5">
      <header className="reader-banner rounded-2xl p-6 sm:p-7">
        <p className="text-xs font-medium tracking-wide text-[var(--brand)]">邮件订阅</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
          确认邮件订阅
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-body)]">
          点击下方确认按钮以激活你的订阅邮箱。
        </p>
      </header>

      <NewsletterConfirmClient mode="verify" token={token} />

      <aside aria-label="订阅说明" className="reader-panel rounded-2xl p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          <span className="font-mono text-[var(--brand)]" aria-hidden="true">
            #
          </span>
          订阅须知
        </h2>
        <ul className="mt-3 divide-y divide-[var(--reader-border)]">
          {verifyNotes.map((note) => (
            <li key={note} className="py-3 text-sm leading-relaxed text-[var(--text-body)] first:pt-1 last:pb-0">
              {note}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
