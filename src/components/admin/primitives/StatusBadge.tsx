interface StatusBadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

const tones = {
  neutral: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
