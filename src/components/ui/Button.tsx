import React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "ui-btn ui-ring inline-flex items-center justify-center rounded-xl font-medium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary:
      "bg-[var(--primary)] text-white hover:opacity-92 focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    secondary:
      "bg-[var(--surface-alt)] text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--surface-alt)_70%,var(--foreground)_8%)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    outline:
      "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-alt)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    ghost:
      "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-alt)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
