"use client";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import type { NewsletterMailerStatus } from "@/lib/newsletter-campaigns";

type NewsletterMailerNoticeProps = {
  mailer?: NewsletterMailerStatus;
};

export function NewsletterMailerNotice({ mailer }: NewsletterMailerNoticeProps) {
  const provider = mailer?.provider;

  return (
    <div className="ed-banner ed-banner--warning mt-4 space-y-1.5 text-[0.8125rem]" role="status">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-serif font-bold text-[var(--foreground)]">发信通道说明</span>
        {provider === "log" ? (
          <StatusBadge tone="warning">模拟发送模式 · log</StatusBadge>
        ) : provider === "noop" ? (
          <StatusBadge tone="muted">未启用发送器 · noop</StatusBadge>
        ) : null}
      </div>
      <p className="leading-6 text-[var(--text-body)]">
        {provider === "noop"
          ? "当前发送器处于未配置状态（noop），未接入真实 SMTP / 邮件 API 供应商，执行发送会明确记录为未接受（failed）；如需本地联调可在「系统设置 → 邮件订阅」切换为 log 模拟。"
          : "当前尚未接入真实 SMTP / 邮件 API 供应商：log 模式仅在服务端记录脱敏日志并标记为「已接受（模拟）」，不会向真实邮箱投递。已接受仅代表适配器接受；中断产生的未知结果（unknown）须人工凭上游回执核对，绝不自动重发。"}
      </p>
    </div>
  );
}
