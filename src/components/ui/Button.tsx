import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * 前台通用按钮，样式全部映射到方向 A 的按钮三级（src/styles/editorial.css）：
 * - primary → .ed-btn（foreground 实底，每页最多一个）
 * - secondary / outline → .ed-btn-outline（描边）
 * - danger → .ed-btn-danger
 * - ghost → 透明底，hover 时 foreground 6% 底（同 .ed-icon-btn）
 *
 * focus 环走全站 :focus-visible 规则（2px var(--focus)，偏移 2px），不再单独写 ring。
 */
const buttonVariants = cva("focus-visible:outline-none disabled:pointer-events-none", {
  variants: {
    variant: {
      primary: "ed-btn",
      secondary: "ed-btn-outline",
      outline: "ed-btn-outline",
      ghost:
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-ctl)] bg-transparent px-3 text-[0.9375rem] font-bold text-[var(--text-body)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--ed-press-bg)] hover:text-[var(--foreground)] active:scale-[0.98] disabled:opacity-45",
      danger: "ed-btn-danger",
    },
    size: {
      sm: "ed-btn--sm",
      md: "",
      lg: "min-h-12 px-6 text-base",
      icon: "h-11 w-11 min-w-11 px-0",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
