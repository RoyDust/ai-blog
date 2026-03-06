interface AdminHeaderProps {
  groupLabel: string;
  currentLabel: string;
}

export function AdminHeader({ groupLabel, currentLabel }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_88%,white_12%)]/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{groupLabel}</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[var(--foreground)]">{currentLabel}</h2>
        </div>
        <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)] md:block">
          简化版 Pro 结构，保留现有工作流
        </div>
      </div>
    </header>
  );
}
