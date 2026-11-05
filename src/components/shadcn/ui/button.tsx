import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // 方向 A：实心主按钮 foreground 底（每页最多一个）、描边、文字按钮三级；圆角 4px，无阴影；
  // 尺寸按后台桌面密度：默认 36px、sm 32px。focus 环由全局 :focus-visible 规则统一处理。
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[4px] border border-transparent text-[0.8125rem] font-bold whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out outline-none active:not-disabled:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-[var(--danger-foreground)] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--card-bg)] hover:bg-[color-mix(in_oklab,var(--foreground)_86%,transparent)]",
        destructive:
          "border-[var(--danger-foreground)] bg-[var(--danger-foreground)] text-[var(--card-bg)] hover:bg-[color-mix(in_oklab,var(--danger-foreground)_88%,transparent)]",
        outline:
          "border-[var(--reader-border-strong)] bg-transparent text-[var(--foreground)] hover:border-[var(--foreground)]",
        secondary:
          "border-[var(--reader-border-strong)] bg-transparent text-[var(--text-body)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]",
        ghost:
          "bg-transparent text-[var(--text-body)] hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)] aria-expanded:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)]",
        link:
          "h-auto! min-h-8 rounded-none border-0 px-0! text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)] active:not-disabled:scale-100",
        "link-danger":
          "h-auto! min-h-8 rounded-none border-0 px-0! text-[var(--danger-foreground)] underline decoration-[color-mix(in_oklab,var(--danger-foreground)_45%,transparent)] decoration-1 underline-offset-4 hover:decoration-[var(--danger-foreground)] active:not-disabled:scale-100",
        "outline-danger":
          "border-[color-mix(in_oklab,var(--danger-foreground)_55%,transparent)] bg-transparent text-[var(--danger-foreground)] hover:border-[var(--danger-foreground)]",
      },
      size: {
        default: "h-9 px-4 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-5 text-[0.875rem] has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
