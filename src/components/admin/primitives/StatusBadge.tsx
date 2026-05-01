import { Badge } from "@/components/admin/ui";

interface StatusBadgeProps {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <Badge tone={tone}>{children}</Badge>;
}
