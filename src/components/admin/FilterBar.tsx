"use client";

interface FilterBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}

export function FilterBar({ placeholder = "搜索", value, onChange, children }: FilterBarProps) {
  return (
    <div className="ui-surface mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <input
        className="ui-ring w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {children}
    </div>
  );
}
