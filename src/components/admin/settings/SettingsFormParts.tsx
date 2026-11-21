"use client";

import type { ReactNode } from "react";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { Button } from "@/components/admin/ui";
import { FormDescription, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { cn } from "@/lib/cn";

/**
 * 设置页表单积木（方向 A 第 15 节 F）：
 * - SettingsSection：第 14 节区块标题（衬线标题 + 同行 muted 说明 + 细线）+ 内容
 * - SettingsFieldItem：标签在上，必填灰「*」（放在 <label> 外，不改变可访问名称），可选「（可选）」，
 *   辅助文字 muted、字段错误 danger（FormMessage）
 * - SettingsGroupTitle：组标题（.75rem 700 muted + 1px 细线）
 * - SettingsNote：左侧 2px 竖线的一段说明文字（替换原来的虚线框）
 * - SettingsSaveRow：页签底部一行，左侧可放说明，右侧本页签唯一的实心保存按钮
 */

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("max-w-[760px]", className)} data-slot="settings-section">
      <AdminSectionHeader title={title} description={description} />
      {description ? <p className="mt-1 text-xs leading-5 text-[var(--text-muted)] md:hidden">{description}</p> : null}
      <div className="flex flex-col gap-5 pt-5">{children}</div>
    </section>
  );
}

export function SettingsFieldItem({
  label,
  required = false,
  optional = false,
  description,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FormItem className={cn("gap-1.5", className)}>
      <div className="flex items-baseline">
        <FormLabel>{label}</FormLabel>
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">
            *
          </span>
        ) : null}
        {optional ? <span className="ml-1 text-[0.8125rem] font-medium text-[var(--text-muted)]">（可选）</span> : null}
      </div>
      {children}
      {description ? <FormDescription className="text-xs leading-[1.55] text-[var(--text-muted)]">{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  );
}

export function SettingsGroupTitle({ children }: { children: ReactNode }) {
  return <p className="border-b border-[var(--border)] pb-1.5 text-xs font-bold text-[var(--text-muted)]">{children}</p>;
}

export function SettingsNote({ children }: { children: ReactNode }) {
  return <p className="border-l-2 border-[var(--reader-border-strong)] py-0.5 pl-3 text-[0.8125rem] leading-[1.65] text-[var(--text-body)]">{children}</p>;
}

export function SettingsSaveRow({
  label,
  submitting,
  aside,
}: {
  label: string;
  submitting: boolean;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div className="min-w-0 text-[0.8125rem] text-[var(--text-muted)]">{aside}</div>
      <Button aria-busy={submitting || undefined} disabled={submitting} type="submit">
        {submitting ? "保存中..." : label}
      </Button>
    </div>
  );
}

/** 设置页输入框的统一类名（36px 控件已由 shadcn Input 提供，这里只补等宽等差异） */
export const settingsMonoInputClassName = "font-mono";
