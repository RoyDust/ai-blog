import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

function Textarea({ className, label, error, helperText, id, ...props }: TextareaProps) {
  const generatedId = React.useId();
  const textareaId = id || generatedId;

  return (
    <div className="w-full">
      {label ? (
        <label className="mb-1 block text-sm font-medium text-[var(--foreground)]" htmlFor={textareaId}>
          {label}
        </label>
      ) : null}
      <textarea
        aria-invalid={Boolean(error)}
        className={cn(
          "ui-ring min-h-28 w-full resize-y rounded-xl border bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted)] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-rose-500 focus-visible:ring-rose-400" : "border-[var(--border)] focus-visible:ring-[var(--ring)]",
          className,
        )}
        id={textareaId}
        {...props}
      />
      {error ? <p className="mt-1 text-sm text-rose-500">{error}</p> : null}
      {helperText && !error ? <p className="mt-1 text-sm text-[var(--muted)]">{helperText}</p> : null}
    </div>
  );
}

export { Textarea };
