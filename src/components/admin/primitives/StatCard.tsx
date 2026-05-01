import type { ReactNode } from "react";
import { Card } from "@/components/admin/ui";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card asChild className="rounded-2xl p-4 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.55)]">
      <article>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
        <p className="mt-3 font-display text-3xl font-bold text-[var(--foreground)]">{value}</p>
        {hint ? <p className="mt-2 text-sm text-[var(--muted)]">{hint}</p> : null}
      </article>
    </Card>
  );
}
