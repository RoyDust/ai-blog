"use client";

import { Search } from "lucide-react";

interface FilterBarProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}

/**
 * 后台列表筛选条（方向 A 第 14 节工具栏）：不套底色块，36px 搜索框 + 右侧文字 tab / 开关，
 * 与表格之间靠留白分开。
 */
export function FilterBar({ label = "搜索", placeholder = "搜索", value, onChange, children }: FilterBarProps) {
  return (
    <div className="mb-3 flex flex-col gap-3 py-1 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-[280px]">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          aria-label={label}
          className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-2.5 pl-8 text-[0.8125rem] text-[var(--foreground)] outline-none transition-colors duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)]"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {children ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div> : null}
    </div>
  );
}
