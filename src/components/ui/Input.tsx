import React, { useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** 标签后的灰色「*」（必填）或「（可选）」 */
  requirement?: "required" | "optional";
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

/** 字段错误文案入场：沿用全站 fade-in-up，prefers-reduced-motion 时由全局规则关掉 */
export const fieldErrorMotionClassName = "animate-[fade-in-up_220ms_cubic-bezier(0.16,1,0.3,1)_both]";

/**
 * 方向 A 输入框（简报第 12 节「全站表单写法」）：
 * - 标签在上方，.8125rem 700，必填写 muted 灰「*」，可选写「（可选）」；
 * - 44px、4px 圆角、1px --reader-border-strong 描边、透明底，不放前置图标；
 * - 字段错误：边框变 danger，下方一句 .8125rem danger 文案（替换辅助说明，不同时出现两行）；
 * - 手机端字号 16px，避免 iOS Safari 聚焦时放大页面。
 *
 * leftSlot / rightSlot 仍然保留给需要内嵌控件的调用方（如显示密码），读者页不再放图标。
 */
export function Input({
  label,
  error,
  helperText,
  requirement,
  leftSlot,
  rightSlot,
  className = "",
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const messageId = `${inputId}-message`;
  const hasAdornment = Boolean(leftSlot || rightSlot);
  const describedBy = [props["aria-describedby"], error || helperText ? messageId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="w-full min-w-0">
      {label ? (
        <label htmlFor={inputId} className="ed-label">
          {label}
          {requirement === "required" ? (
            <span aria-hidden="true" className="ed-label__required">
              *
            </span>
          ) : null}
          {requirement === "optional" ? <span className="ed-label__optional">（可选）</span> : null}
        </label>
      ) : null}
      <div className={hasAdornment ? "relative" : undefined}>
        {leftSlot ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">{leftSlot}</div>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "ed-input text-base sm:text-[0.9375rem]",
            leftSlot ? "pl-11" : "",
            rightSlot ? "pr-12" : "",
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-required={requirement === "required" ? true : undefined}
          {...props}
          aria-describedby={describedBy}
        />
        {rightSlot ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div> : null}
      </div>
      {error ? (
        <p key={error} id={messageId} className={cn("ed-field-error", fieldErrorMotionClassName)}>
          {error}
        </p>
      ) : helperText ? (
        <p id={messageId} className="ed-field-hint">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
