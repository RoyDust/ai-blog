"use client";

interface FilterBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}

export function FilterBar({ placeholder = "搜索", value, onChange, children }: FilterBarProps) {
  return (
    <div className="ui-surface mb-4 flex flex-col gap-3 rounded-2xl p-3 shadow-[0_14px_28px_-24px_rgba(15,118,110,0.45)] md:flex-row md:items-center md:justify-between md:p-4">
      <input
        className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:max-w-md"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
