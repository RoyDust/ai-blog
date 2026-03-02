import React from "react";
import { cn } from "@/lib/cn";

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
        "ui-surface rounded-2xl shadow-sm",
        hover && "cursor-pointer transition-shadow hover:shadow-lg",
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
