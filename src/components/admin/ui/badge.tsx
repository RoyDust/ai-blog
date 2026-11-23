import type * as React from "react";
import {
  Badge as CossBadge,
  badgeVariants,
} from "@/components/coss/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";

const toneClassNames: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  success: "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-foreground)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-foreground)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-foreground)]",
};

export type BadgeProps = Omit<
  React.ComponentProps<typeof CossBadge>,
  "variant"
> & {
  tone?: Tone;
};

function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <CossBadge
      variant="outline"
      className={cn(toneClassNames[tone], className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
