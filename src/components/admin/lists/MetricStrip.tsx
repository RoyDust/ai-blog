"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import { ActiveUnderline } from "@/components/editorial";
import { cn } from "@/lib/cn";

export type MetricStripTone = "default" | "success" | "warning" | "danger" | "info";

export interface MetricStripItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** 一行口径说明（.6875rem muted） */
  note?: ReactNode;
  /** 数值的语气色（待审核 warning、成功 success、失败 danger） */
  tone?: MetricStripTone;
  /** 可筛选项：传 onSelect 即渲染为 aria-pressed 按钮 */
  onSelect?: () => void;
  pressed?: boolean;
  /** 按钮的可访问名称（默认用 label 文本） */
  ariaLabel?: string;
}

const valueToneClassName: Record<MetricStripTone, string> = {
  default: "text-[var(--foreground)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger-foreground)]",
  info: "text-[var(--focus)]",
};

/**
 * 后台列表指标条（方向 A 第 14 节）：一行 1px 竖线分隔的「标签 + 等宽数字 + 一行说明」。
 * 能筛选的项是 aria-pressed 按钮，当前项标签 700 + 底部 2px sky 线（layoutId 平移）；只展示的项不可点。
 */
export function MetricStrip({
  items,
  ariaLabel = "列表指标",
  className,
}: {
  items: MetricStripItem[];
  ariaLabel?: string;
  className?: string;
}) {
  const underlineId = useId();
  const hasFilter = items.some((item) => item.onSelect);

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        // 手机：横向滑动；lg 起等分网格
        "relative flex overflow-x-auto border-b border-[var(--border)] [scrollbar-width:none] lg:grid lg:grid-cols-[repeat(var(--metric-cols),minmax(0,1fr))] lg:overflow-visible",
        className,
      )}
      data-slot="admin-metric-strip"
      role={hasFilter ? "group" : undefined}
      style={{ "--metric-cols": items.length } as CSSProperties}
    >
      {items.map((item, index) => {
        const isFirst = index === 0;
        const toneClassName = valueToneClassName[item.tone ?? "default"];
        const body = (
          <>
            <span
              className={cn(
                "text-xs leading-5 whitespace-nowrap",
                item.pressed ? "font-bold text-[var(--foreground)]" : "font-medium text-inherit",
              )}
            >
              {item.label}
            </span>
            <span className={cn("font-mono text-[1.25rem] leading-[1.35] font-bold tabular-nums whitespace-nowrap", toneClassName)}>
              {item.value}
            </span>
            {item.note ? <span className="truncate text-[0.6875rem] leading-normal text-[var(--text-muted)]">{item.note}</span> : null}
            {item.pressed ? (
              <ActiveUnderline
                className={cn("absolute right-0 bottom-[-1px] h-0.5 bg-[var(--accent-sky)]", isFirst ? "left-0" : "left-[18px]")}
                layoutId={`metric-strip-${underlineId}`}
              />
            ) : null}
          </>
        );
        const cellClassName = cn(
          "relative flex min-w-[8.5rem] shrink-0 flex-col items-start gap-px py-3 text-left lg:min-w-0",
          isFirst ? "pr-[18px] lg:pr-0" : "border-l border-[var(--border)] px-[18px] lg:pr-0",
        );

        if (item.onSelect) {
          return (
            <button
              key={item.key}
              aria-label={item.ariaLabel}
              aria-pressed={Boolean(item.pressed)}
              className={cn(
                cellClassName,
                "cursor-pointer text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--foreground)] active:opacity-80",
              )}
              data-metric-key={item.key}
              onClick={item.onSelect}
              type="button"
            >
              {body}
            </button>
          );
        }

        return (
          <div key={item.key} className={cn(cellClassName, "text-[var(--text-muted)]")} data-metric-key={item.key}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
