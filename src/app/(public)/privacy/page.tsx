export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { InViewReveal } from "@/components/motion";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "隐私政策",
    description: `了解 ${settings.siteName} 如何处理账号资料、评论互动、邮件订阅与脱敏安全日志。`,
    path: "/privacy",
    siteUrl: settings.siteUrl,
  });
}

function buildPrivacySections(siteName: string) {
  return [
    {
      id: "privacy-account",
      title: "账号与互动信息",
      items: [
        `当你在 ${siteName} 注册账号或通过 GitHub 登录时，系统仅保存维持账号所需的最小信息：显示名称、登录邮箱、可选头像链接，以及经 bcrypt 单向哈希加密后的密码摘要（不存储明文密码）。`,
        "当你发表评论或点赞互动时，系统会记录与你账号（或匿名浏览器标识）关联的互动内容及提交时间，用于在前台展示评论并执行反垃圾审核。",
      ],
    },
    {
      id: "privacy-storage",
      title: "Cookie 与浏览器本地存储",
      items: [
        "登录态通过启用 HttpOnly 与 SameSite 保护的会话 Cookie 维持，不用于跨站广告追踪；退出登录时会同步清理会话凭据。",
        "「我的收藏」书签列表与日夜阅读主题偏好默认保存在你当前设备的浏览器 localStorage 中，你可以随时在站内取消收藏或清理浏览器缓存。",
      ],
    },
    {
      id: "privacy-newsletter",
      title: "邮件订阅（Newsletter）",
      items: [
        "邮件订阅完全遵循自愿与双重确认（Double Opt-In）原则：提交邮箱后，仅在你点击确认邮件中的验证链接后订阅才会生效。",
        "每封精选文章或日报摘要邮件底部均包含独立的一键退订链接，确认退订后系统将立即停止向该邮箱发送后续刊物。",
      ],
    },
    {
      id: "privacy-logs",
      title: "操作审计与脱敏日志",
      items: [
        "为防范暴力请求、保障服务安全与排查线上故障，服务端操作日志与阅读访问统计会对客户端 IP 进行单向哈希脱敏存储（ipHash），不会在审计日志中明文保存密码、令牌或私密凭据。",
        "操作日志按站点存储配额滚动清理，仅限授权管理员出于安全运维目的查阅。",
      ],
    },
    {
      id: "privacy-rights",
      title: "资料管理与联系渠道",
      items: [
        "登录用户可随时前往「个人资料」页面查看或更新显示名称、登录邮箱与头像链接。",
        `如对 ${siteName} 的数据处理方式有疑问，或需要协助处理账号相关请求，请通过「联系我」页面发送邮件。`,
      ],
    },
  ];
}

export default async function PrivacyPage() {
  const settings = await getBlogSettings();
  const sections = buildPrivacySections(settings.siteName);

  return (
    <div className="reader-section space-y-4" data-testid="privacy-page">
      <InViewReveal className="reader-panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-md bg-[var(--btn-regular-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--btn-content)]">
              协议
            </span>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              隐私政策
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--text-body)]">
              {settings.siteName} 重视读者隐私，遵循最小必要与默认脱敏原则处理与你相关的数据。
            </p>
            <p className="font-mono text-xs text-[var(--text-muted)]">适用站点：{settings.siteName}</p>
          </div>
          <Link className="ui-link text-sm font-semibold" href="/terms">
            服务条款
          </Link>
        </div>
      </InViewReveal>

      <InViewReveal className="reader-panel divide-y divide-[var(--line-color)] p-6 sm:p-8">
        {sections.map((section, sectionIndex) => (
          <section key={section.id} aria-labelledby={section.id} className="py-5 first:pt-0 last:pb-0">
            <h2 id={section.id} className="reader-section-heading flex items-baseline gap-2 text-base sm:text-lg">
              <span className="font-mono text-xs text-[var(--brand)]">{String(sectionIndex + 1).padStart(2, "0")}</span>
              <span>{section.title}</span>
            </h2>
            <div className="mt-2.5 space-y-2.5">
              {section.items.map((paragraph) => (
                <p key={paragraph} className="max-w-[46rem] text-sm leading-7 text-[var(--text-body)]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}

        <aside aria-label="相关页面" className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-5 text-sm">
          <Link className="ui-link font-medium" href="/register">
            返回账号注册
          </Link>
          <Link className="ui-link font-medium" href="/terms">
            阅读服务条款
          </Link>
          <Link className="ui-link font-medium" href="/contact">
            联系站点维护者
          </Link>
        </aside>
      </InViewReveal>
    </div>
  );
}
