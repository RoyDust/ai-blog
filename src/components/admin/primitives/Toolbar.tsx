import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ToolbarProps {
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/**
 * 列表工具栏（方向 A 第 14 节）：放在区块标题之下、表格之上，不套底色块。
 * 左侧放 36px 搜索框、文字 tab 筛选、复选框开关（组间用 <ToolbarDivider />），右侧放批量操作或说明。
 */
export function Toolbar({ leading, trailing, className }: ToolbarProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-3 pb-3.5", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{leading}</div>
      {trailing ? <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-[var(--text-muted)]">{trailing}</div> : null}
    </div>
  );
}

/** 工具栏里的 1px 竖线分组 */
export function ToolbarDivider() {
  return <span aria-hidden="true" className="h-5 w-px shrink-0 bg-[var(--border)]" />;
}
