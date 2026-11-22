"use client";

interface FilterBarProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}

export function FilterBar({ label = "搜索", placeholder = "搜索", value, onChange, children }: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] md:flex-row md:items-center md:justify-between md:px-4 md:py-3">
      <input
        aria-label={label}
        className="ui-ring h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/75 px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:max-w-md"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
