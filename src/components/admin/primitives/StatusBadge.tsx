interface StatusBadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

const tones = {
  neutral: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground)]",
  success: "ui-status-success",
  warning: "ui-status-warning",
  danger: "ui-status-danger",
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}
