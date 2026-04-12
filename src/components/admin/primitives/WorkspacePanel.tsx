import { Children, type ReactNode } from "react";

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
    <section className={`ui-surface rounded-3xl ${className}`}>
      {(title || description || actions) ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            {title ? <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="px-5 py-4">{shouldShowEmptyState ? emptyState : children}</div>
    </section>
  );
}
