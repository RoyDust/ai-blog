import * as React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const inputClassName =
  "ui-ring w-full rounded-xl border bg-[var(--surface)] px-4 py-2 text-[var(--foreground)] transition-colors placeholder:text-[var(--muted)] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

function Input({ className, label, error, helperText, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full">
      {label ? (
        <label className="mb-1 block text-sm font-medium text-[var(--foreground)]" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        aria-invalid={Boolean(error)}
        className={cn(
          inputClassName,
          error ? "border-rose-500 focus-visible:ring-rose-400" : "border-[var(--border)] focus-visible:ring-[var(--ring)]",
          className,
        )}
        id={inputId}
        {...props}
      />
      {error ? <p className="mt-1 text-sm text-rose-500">{error}</p> : null}
      {helperText && !error ? <p className="mt-1 text-sm text-[var(--muted)]">{helperText}</p> : null}
    </div>
  );
}

export { Input, inputClassName };
