import { Children, type ReactNode } from "react";
import { Card, CardContent } from "@/components/admin/ui";
import { MotionReveal } from "@/components/motion";

interface WorkspacePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
  delayIndex?: number;
  fillHeight?: boolean;
}

export function WorkspacePanel({
  title,
  description,
  actions,
  emptyState,
  children,
  className = "",
  delayIndex = 0,
  fillHeight = true,
}: WorkspacePanelProps) {
  const shouldShowEmptyState = Boolean(emptyState) && Children.toArray(children).length === 0;

  return (
    <MotionReveal className={fillHeight ? "h-full" : ""} delayIndex={delayIndex}>
      <Card className={`${className} ${fillHeight ? "h-full" : ""} flex flex-col border border-[var(--border)] bg-[var(--surface)] shadow-sm rounded-lg transition-colors duration-200`}>
        <section className={`flex flex-col ${fillHeight ? "h-full flex-1" : ""}`}>
          {title || description || actions ? (
            <header className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3.5 pt-5 border-b border-[var(--border)]">
              <div>
                {title ? <h2 className="font-display text-base font-bold tracking-tight text-[var(--foreground)]">{title}</h2> : null}
                {description ? <p className="mt-1.5 text-xs text-[var(--muted)]">{description}</p> : null}
              </div>
              {actions}
            </header>
          ) : null}
          <CardContent className={`pt-4 pb-5 flex flex-col ${fillHeight ? "flex-1" : ""}`}>{shouldShowEmptyState ? emptyState : children}</CardContent>
        </section>
      </Card>
    </MotionReveal>
  );
}
