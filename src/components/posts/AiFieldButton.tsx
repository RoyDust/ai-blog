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
      className="ui-ring inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[var(--brand)] transition-colors hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled || loading}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
