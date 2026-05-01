import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground)]",
      success: "ui-status-success",
      warning: "ui-status-warning",
      danger: "ui-status-danger",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { Badge, badgeVariants };
