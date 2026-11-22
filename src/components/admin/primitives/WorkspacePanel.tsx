import { Children, type ReactNode } from "react";
import { Card, CardContent } from "@/components/admin/ui";

interface WorkspacePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
  fillHeight?: boolean;
}

export function WorkspacePanel({
  title,
  description,
  actions,
  emptyState,
  children,
  className = "",
  fillHeight = true,
}: WorkspacePanelProps) {
  const shouldShowEmptyState = Boolean(emptyState) && Children.toArray(children).length === 0;

  return (
    <Card className={`${className} ${fillHeight ? "h-full" : ""} flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]`}>
      <section className={`flex flex-col ${fillHeight ? "h-full flex-1" : ""}`}>
        {title || description || actions ? (
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 pb-3 pt-4">
            <div>
              {title ? <h2 className="font-display text-[15px] font-bold tracking-tight text-[var(--foreground)]">{title}</h2> : null}
              {description ? <p className="mt-1 text-xs text-[var(--muted)]">{description}</p> : null}
            </div>
            {actions}
          </header>
        ) : null}
        <CardContent className={`px-4 pt-3.5 pb-4 flex flex-col ${fillHeight ? "flex-1" : ""}`}>{shouldShowEmptyState ? emptyState : children}</CardContent>
      </section>
    </Card>
  );
}
