import type { ReactNode } from "react";

interface EntityFormShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function EntityFormShell({ title, description, children }: EntityFormShellProps) {
  return (
    <section className="ui-surface rounded-xl p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
