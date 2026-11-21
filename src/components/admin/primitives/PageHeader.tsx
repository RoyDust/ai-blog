import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-card)]">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {eyebrow ? <p className="text-xs font-semibold text-[var(--brand)]">{eyebrow}</p> : null}
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--foreground)]">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--muted)]">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </section>
    </div>
  );
}
