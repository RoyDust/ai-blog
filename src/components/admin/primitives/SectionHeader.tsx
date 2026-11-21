import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AdminSectionHeaderProps {
  title: ReactNode;
  /** 标题后的 muted 说明（第 14 节「文章列表 发布状态、AI 摘要和数据上下文」） */
  description?: ReactNode;
  /** 标题后的等宽计数 */
  count?: ReactNode;
  /** 右侧：等宽「第 X / N 页 · N 条记录」、muted 小字、文字 tab 或文字链接 */
  aside?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}

/**
 * 后台区块标题（方向 A）：衬线 1.125rem 标题 + muted 说明 + 横贯 1px 细线 + 右侧小字或控件。
 * 比前台区块标题（1.25rem）小一档。
 */
export function AdminSectionHeader({ title, description, count, aside, as: Tag = "h2", id, className }: AdminSectionHeaderProps) {
  return (
    <div className={cn("flex min-h-8 items-center gap-3", className)} data-slot="admin-section-header">
      <Tag id={id} className="shrink-0 font-serif text-[1.125rem] leading-[1.3] font-bold text-[var(--foreground)]">
        {title}
        {count !== undefined && count !== null ? (
          <span className="ed-mono ml-2 text-[0.9375rem] font-medium text-[var(--text-muted)]">{count}</span>
        ) : null}
      </Tag>
      {description ? <span className="hidden min-w-0 shrink truncate text-[0.8125rem] text-[var(--text-muted)] md:inline">{description}</span> : null}
      <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-[var(--border)]" />
      {aside ? <div className="flex shrink-0 items-center gap-3.5 text-[0.8125rem] text-[var(--text-muted)]">{aside}</div> : null}
    </div>
  );
}
