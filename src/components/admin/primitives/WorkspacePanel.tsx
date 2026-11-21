import { Children, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AdminSectionHeader } from "./SectionHeader";

interface WorkspacePanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyState?: ReactNode;
  children: ReactNode;
  className?: string;
  fillHeight?: boolean;
  /**
   * section（默认）：纸面里的一个区块，区块标题写法（衬线 1.125rem + 1px 横线 + 右侧控件），说明在下一行；
   * pane：工作台侧栏分段（衬线 1rem 标题 + .75rem muted 说明），段与段之间 1px 强线。
   */
  variant?: "section" | "pane";
}

/**
 * 后台面板（方向 A）：不再是带标题栏的圆角卡片，而是同一张纸面里的分段。
 */
export function WorkspacePanel({
  title,
  description,
  actions,
  emptyState,
  children,
  className = "",
  fillHeight = true,
  variant = "section",
}: WorkspacePanelProps) {
  const shouldShowEmptyState = Boolean(emptyState) && Children.toArray(children).length === 0;
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col",
        `${fillHeight ? "h-full" : ""}`,
        variant === "pane" && "border-t border-[var(--reader-border-strong)] pt-4 first:border-t-0 first:pt-0",
        className,
      )}
      data-slot="workspace-panel"
      data-variant={variant}
    >
      {hasHeader ? (
        variant === "pane" ? (
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? <h2 className="font-serif text-base leading-snug font-bold text-[var(--foreground)]">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>
        ) : (
          <header>
            {title ? <AdminSectionHeader title={title} aside={actions} /> : actions ? <div className="flex justify-end">{actions}</div> : null}
            {description ? <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p> : null}
          </header>
        )
      ) : null}
      <div className={cn("flex min-w-0 flex-col", hasHeader && "pt-3.5", fillHeight && "flex-1")}>{shouldShowEmptyState ? emptyState : children}</div>
    </section>
  );
}
