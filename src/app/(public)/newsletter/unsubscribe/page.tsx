import type { Metadata } from "next";

import { Masthead, Reveal, SectionHeading } from "@/components/editorial";
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
    <div className="space-y-6">
      <Reveal>
        <Masthead
          description="请确认是否停止接收本站的精选文章与日报邮件。"
          eyebrow="邮件订阅"
          title="取消邮件订阅"
        />
      </Reveal>

      <Reveal delay={0.06}>
        <NewsletterConfirmClient mode="unsubscribe" token={token} />
      </Reveal>

      <Reveal aria-label="退订说明" as="aside" className="pt-3" delay={0.1}>
        <SectionHeading title="退订说明" />
        <ul>
          {unsubscribeNotes.map((note) => (
            <li
              key={note}
              className="border-b border-[var(--border)] py-3 text-[0.875rem] leading-[1.7] text-[var(--text-body)]"
            >
              {note}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
