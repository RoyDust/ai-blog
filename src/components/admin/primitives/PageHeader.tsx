import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-0 rounded-lg bg-[var(--surface)] p-5 border-none shadow-none">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {eyebrow ? <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{eyebrow}</p> : null}
            <h1 className="mt-1 font-display text-3xl font-extrabold text-[var(--foreground)]">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      </section>
    </div>
  );
}
