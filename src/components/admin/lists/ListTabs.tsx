"use client";

import { useId } from "react";

import { ActiveUnderline } from "@/components/editorial";
import { adminTabClassName } from "@/components/admin/primitives/admin-classes";
import { cn } from "@/lib/cn";

export interface ListTabItem<T extends string> {
  value: T;
  label: string;
}

/**
 * 工具栏里的文字 tab 筛选（方向 A 第 14 节）：aria-pressed 按钮，当前项 foreground + 2px sky 下划线平移。
 * 与指标条共用同一个筛选状态。
 */
export function ListTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: ReadonlyArray<ListTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const underlineId = useId();

  return (
    <div aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-1", className)} role="group">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            aria-pressed={active}
            className={cn(adminTabClassName, "active:opacity-80")}
            onClick={() => onChange(item.value)}
            type="button"
          >
            {item.label}
            {active ? <ActiveUnderline layoutId={`list-tabs-${underlineId}`} /> : null}
          </button>
        );
      })}
    </div>
  );
}
