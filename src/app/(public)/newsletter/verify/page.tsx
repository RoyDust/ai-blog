import type { Metadata } from "next";

import { Masthead, Reveal, SectionHeading } from "@/components/editorial";
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
    <div className="space-y-6">
      <Reveal>
        <Masthead
          description="点击下方确认按钮以激活你的订阅邮箱。"
          eyebrow="邮件订阅"
          title="确认邮件订阅"
        />
      </Reveal>

      <Reveal delay={0.06}>
        <NewsletterConfirmClient mode="verify" token={token} />
      </Reveal>

      <Reveal aria-label="订阅说明" as="aside" className="pt-3" delay={0.1}>
        <SectionHeading title="订阅须知" />
        <ul>
          {verifyNotes.map((note) => (
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
