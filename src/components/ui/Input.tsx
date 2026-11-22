import React, { useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  requirement?: "required" | "optional";
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const fieldErrorMotionClassName = "animate-[fade-in-up_220ms_cubic-bezier(0.16,1,0.3,1)_both]";

export function Input({
  label,
  error,
  helperText,
  requirement,
  leftSlot,
  rightSlot,
  className = '',
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
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-[var(--foreground)]"
        >
          {label}
          {requirement === "required" ? (
            <span aria-hidden="true" className="ml-0.5 text-[var(--danger-foreground)]">
              *
            </span>
          ) : null}
          {requirement === "optional" ? (
            <span className="ml-1 font-normal text-[var(--muted)]">（可选）</span>
          ) : null}
        </label>
      )}
      <div className={hasAdornment ? "relative" : undefined}>
        {leftSlot ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            {leftSlot}
          </div>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "ui-ring w-full rounded-xl border bg-[var(--surface)] px-4 py-2 text-base sm:text-sm text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
            leftSlot ? "pl-11" : "",
            rightSlot ? "pr-12" : "",
            error
              ? "border-rose-500 focus-visible:ring-rose-400"
              : "border-[var(--border)] focus-visible:ring-[var(--ring)]",
            className
          )}
          aria-invalid={Boolean(error)}
          aria-required={requirement === "required" ? true : undefined}
          {...props}
          aria-describedby={describedBy}
        />
        {rightSlot ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div> : null}
      </div>
      {error ? (
        <p key={error} id={messageId} className={cn("mt-1 text-sm text-rose-500", fieldErrorMotionClassName)}>
          {error}
        </p>
      ) : helperText ? (
        <p id={messageId} className="mt-1 text-sm text-[var(--muted)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
