import React, { useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-[var(--foreground)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "ui-ring w-full rounded-xl border bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
          error
            ? "border-rose-500 focus-visible:ring-rose-400"
            : "border-[var(--border)] focus-visible:ring-[var(--ring)]",
          className
        )}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-rose-500">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-[var(--muted)]">{helperText}</p>
      )}
    </div>
  );
}
