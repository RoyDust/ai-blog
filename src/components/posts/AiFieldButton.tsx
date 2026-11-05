"use client";

import { AiTextButton } from "@/components/admin/workspace/WorkspaceKit";

/**
 * 字段级 AI 动作按钮（方向 A）：等宽「AI」文字按钮，info 色、28px 高。
 *
 * - placement="field"（默认）：放在输入框内右侧，左侧 1px 竖线隔开
 * - placement="label"：放在标签行右侧（分类、标签）
 * loading 时换成静态转圈并禁用；aria-label / title 沿用传入的 label。
 */
export function AiFieldButton({
  disabled,
  label,
  loading,
  onClick,
  placement = "field",
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick: () => void;
  placement?: "field" | "label";
}) {
  return (
    <AiTextButton
      disabled={disabled}
      label={label}
      loading={loading}
      onClick={onClick}
      separated={placement === "field"}
    />
  );
}
