import type { ReactNode } from "react";
import { Card } from "@/components/admin/ui";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <Card asChild className="rounded-3xl p-5 shadow-[0_18px_40px_-32px_rgba(15,118,110,0.6)]">
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
    </Card>
  );
}
