import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/admin/ui";

export type StatusTone = Extract<BadgeTone, "neutral" | "success" | "warning" | "danger" | "info" | "muted">;

interface StatusBadgeProps {
  /** 语气：success 已完成 / warning 待处理 / danger 失败 / info 进行中（focus 色） / muted 次要 */
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * 后台状态（方向 A）：不再是药丸，改为 .75rem 700 的语气色文字。
 * 与同行说明并排时直接放在文字前，例如「已生成 摘要预览……」。
 */
export function StatusBadge({ tone = "neutral", children, className, title }: StatusBadgeProps) {
  return (
    <Badge className={className} title={title} tone={tone}>
      {children}
    </Badge>
  );
}
