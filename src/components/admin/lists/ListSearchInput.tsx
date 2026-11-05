"use client";

import { Search } from "lucide-react";

import { cn } from "@/lib/cn";

export const listInputClassName =
  "h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-2.5 text-base text-[var(--foreground)] outline-none transition-colors duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] sm:text-[0.8125rem]";

/**
 * 工具栏 36px 搜索框（方向 A 第 14 节）：放大镜图标 + 1px 强描边，不套底色。
 * 手机端 16px 字号，避免 iOS 聚焦缩放。
 */
export function ListSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** 没有可见 label 时的可访问名称；用 <label htmlFor> 时可省略 */
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-[280px]", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-[var(--text-muted)]"
      />
      <input
        aria-label={ariaLabel}
        className={cn(listInputClassName, "pl-8")}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </div>
  );
}

/** 工具栏里的复选框开关（「非 AI 日报」「显示自身」） */
export function ListCheckboxToggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-2 text-[0.8125rem] font-bold whitespace-nowrap text-[var(--text-body)] transition-colors hover:text-[var(--foreground)]",
        className,
      )}
    >
      <input checked={checked} className="ed-checkbox" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}
