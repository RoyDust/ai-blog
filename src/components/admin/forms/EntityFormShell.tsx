import type { ReactNode } from "react";

interface EntityFormShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * 实体表单分段（方向 A）：纸面里的一段，衬线标题 + muted 说明，上方 1px 强线分隔，不再是卡片。
 */
export function EntityFormShell({ title, description, children }: EntityFormShellProps) {
  return (
    <section className="border-t border-[var(--reader-border-strong)] pt-4">
      <h2 className="font-serif text-base font-bold text-[var(--foreground)]">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
