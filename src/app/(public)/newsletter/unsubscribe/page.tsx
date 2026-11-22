import type { Metadata } from "next";

import { getBlogSettings } from "@/lib/blog-settings";
import { buildPageMetadata } from "@/lib/seo";
import { NewsletterConfirmClient } from "../NewsletterConfirmClient";

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return {
    ...buildPageMetadata({
      title: "取消邮件订阅",
      description: "确认退订 Newsletter 精选邮件。",
      path: "/newsletter/unsubscribe",
      siteUrl: settings.siteUrl,
    }),
    robots: {
      index: false,
      follow: false,
    },
  };
}

const unsubscribeNotes = [
  "退订立即生效，正在投递中的队列也会在逐封发送前复核退订状态并自动跳过。",
  "如果今后希望重新接收精选文章，可在站点首页再次输入邮箱并重新确认。",
];

export default async function NewsletterUnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  return (
    <div className="onload-animation space-y-5">
      <header className="reader-banner rounded-2xl p-6 sm:p-7">
        <p className="text-xs font-medium tracking-wide text-[var(--brand)]">邮件订阅</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-[1.75rem]">
          取消邮件订阅
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-body)]">
          请确认是否停止接收本站的精选文章与日报邮件。
        </p>
      </header>

      <NewsletterConfirmClient mode="unsubscribe" token={token} />

      <aside aria-label="退订说明" className="reader-panel rounded-2xl p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
          <span className="font-mono text-[var(--brand)]" aria-hidden="true">
            #
          </span>
          退订说明
        </h2>
        <ul className="mt-3 divide-y divide-[var(--reader-border)]">
          {unsubscribeNotes.map((note) => (
            <li key={note} className="py-3 text-sm leading-relaxed text-[var(--text-body)] first:pt-1 last:pb-0">
              {note}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
