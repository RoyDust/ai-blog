import type * as React from "react";
import {
  Badge as ShadcnBadge,
  badgeVariants,
} from "@/components/shadcn/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";

const toneClassNames: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export type BadgeProps = Omit<
  React.ComponentProps<typeof ShadcnBadge>,
  "variant"
> & {
  tone?: Tone;
};

function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(toneClassNames[tone], className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
