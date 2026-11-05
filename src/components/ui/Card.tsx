import React from "react";
import { cn } from "@/lib/cn";

/** 方向 A：一张纸（card-bg + 1px 描边 + 6px 圆角），不加投影、不做 hover 上浮。 */

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-paper)] border border-[var(--reader-border)] bg-[var(--card-bg)] text-[var(--foreground)]",
        hover && "cursor-pointer transition-colors duration-200 hover:border-[var(--reader-border-strong)]",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-[var(--border)] px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-[var(--border)] px-6 py-4", className)}>
      {children}
    </div>
  );
}
