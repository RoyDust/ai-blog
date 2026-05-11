import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "ui-btn ui-ring inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-white hover:opacity-92 focus-visible:ring-[var(--ring)]",
        secondary:
          "bg-[var(--surface-alt)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--surface-alt)_70%,var(--foreground)_8%)] focus-visible:ring-[var(--ring)]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-alt)] focus-visible:ring-[var(--ring)]",
        ghost: "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-alt)] focus-visible:ring-[var(--ring)]",
        danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

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
