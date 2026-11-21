import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // 方向 A：徽标不再是药丸，改为 .75rem 700 的语气色文字
  "inline-flex w-fit shrink-0 items-center gap-1 text-xs leading-snug font-bold whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "text-[var(--foreground)]",
        secondary: "text-[var(--text-muted)]",
        destructive: "text-[var(--danger-foreground)]",
        outline: "text-[var(--text-body)]",
        ghost: "text-[var(--text-muted)]",
        link: "text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] underline-offset-4 [a&]:hover:decoration-[var(--accent-sky)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
