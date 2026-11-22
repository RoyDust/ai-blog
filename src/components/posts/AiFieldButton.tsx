"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

/**
 * 字段级 AI 动作按钮。
 *
 * 用统一的图标、loading 和禁用态包装标题、slug、分类、标签、摘要等小型 AI 补全入口。
 */
export function AiFieldButton({
  disabled,
  label,
  loading,
  onClick,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  const Icon = loading ? LoaderCircle : Sparkles;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="ui-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-[var(--btn-content)] transition-colors hover:bg-[var(--btn-regular-bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled || loading}
      onClick={onClick}
    >
      <Icon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
