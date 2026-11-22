import type { ReactNode } from "react";

interface ToolbarProps {
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Toolbar({ leading, trailing }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </div>
  );
}
