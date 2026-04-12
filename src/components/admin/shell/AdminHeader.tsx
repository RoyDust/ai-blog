interface AdminHeaderProps {
  groupLabel: string;
  currentLabel: string;
}

export function AdminHeader({ groupLabel, currentLabel }: AdminHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">{groupLabel}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-[var(--foreground)]">{currentLabel}</h1>
      </div>
    </header>
  );
}
