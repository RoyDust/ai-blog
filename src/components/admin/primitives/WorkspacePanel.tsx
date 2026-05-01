import { Children, type ReactNode } from "react";
import { Card, CardContent } from "@/components/admin/ui";

interface WorkspacePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function WorkspacePanel({
  title,
  description,
  actions,
  emptyState,
  children,
  className = "",
}: WorkspacePanelProps) {
  const shouldShowEmptyState = Boolean(emptyState) && Children.toArray(children).length === 0;

  return (
    <Card asChild className={className}>
      <section>
        {title || description || actions ? (
          <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
            <div>
              {title ? <h2 className="font-display text-lg font-semibold leading-none text-[var(--foreground)]">{title}</h2> : null}
              {description ? <p className="mt-3 text-sm leading-5 text-[var(--muted)]">{description}</p> : null}
            </div>
            {actions}
          </header>
        ) : null}
        <CardContent>{shouldShowEmptyState ? emptyState : children}</CardContent>
      </section>
    </Card>
  );
}
