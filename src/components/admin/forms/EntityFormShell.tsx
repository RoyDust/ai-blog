import type { ReactNode } from "react";

interface EntityFormShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function EntityFormShell({ title, description, children }: EntityFormShellProps) {
  return (
    <section className="ui-surface rounded-2xl p-5 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.45)]">
      <h2 className="font-display text-xl font-bold text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
