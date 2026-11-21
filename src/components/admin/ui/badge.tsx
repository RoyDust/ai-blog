import type * as React from "react";
import { badgeVariants } from "@/components/shadcn/ui/badge";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

/** 方向 A：状态不再是药丸，而是 .75rem 700 的语气色文字（info 用 focus 色）。 */
export const badgeToneClassNames: Record<BadgeTone, string> = {
  neutral: "text-[var(--text-body)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger-foreground)]",
  info: "text-[var(--focus)]",
  muted: "text-[var(--text-muted)]",
};

export type BadgeProps = React.ComponentProps<"span"> & {
  tone?: BadgeTone;
};

function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 text-xs leading-snug font-bold whitespace-nowrap [&>svg]:size-3",
        badgeToneClassNames[tone],
        className,
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
