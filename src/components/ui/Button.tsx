import * as React from "react";
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

function mergeSlotProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...slotProps, ...childProps };

  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];

    if (key === "className") {
      merged.className = cn(
        typeof slotValue === "string" ? slotValue : undefined,
        typeof childValue === "string" ? childValue : undefined,
      );
    } else if (key === "style") {
      merged.style = {
        ...((slotValue as React.CSSProperties | undefined) ?? {}),
        ...((childValue as React.CSSProperties | undefined) ?? {}),
      };
    } else if (/^on[A-Z]/.test(key) && typeof slotValue === "function" && typeof childValue === "function") {
      merged[key] = (...args: unknown[]) => {
        (childValue as (...a: unknown[]) => unknown)(...args);
        (slotValue as (...a: unknown[]) => unknown)(...args);
      };
    }
  }

  return merged;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild && React.isValidElement<Record<string, unknown>>(children)) {
    return React.cloneElement(
      children,
      mergeSlotProps({ ...props, className: classes }, children.props),
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export { Button, buttonVariants };
