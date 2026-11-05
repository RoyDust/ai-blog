"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/ui/dialog";

type ModalBaseProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  showCloseButton?: boolean;
  panelClassName?: string;
  contentClassName?: string;
};

/**
 * 方向 A 弹窗：纸面色、1px 强描边、6px 圆角、无阴影，标题衬线，标题下 1px 细线分隔内容。
 *
 * 标题与可访问名称至少提供其一：title 渲染可见标题；无 title 时 ariaLabel
 * 作为 sr-only 标题。两者皆缺在类型层即被禁止，避免产生无名 dialog。
 */
export type ModalProps = ModalBaseProps & ({ title: string; ariaLabel?: string } | { title?: never; ariaLabel: string });

// DialogContent 自带 sm:max-w-lg，尺寸同时写 sm: 前缀才能在桌面生效
const sizes = {
  sm: "max-w-sm sm:max-w-sm",
  md: "max-w-md sm:max-w-md",
  lg: "max-w-lg sm:max-w-lg",
  xl: "max-w-xl sm:max-w-xl",
  "2xl": "max-w-2xl sm:max-w-2xl",
  "3xl": "max-w-3xl sm:max-w-3xl",
  "4xl": "max-w-4xl sm:max-w-4xl",
};

function Modal({ isOpen, onClose, title, ariaLabel, children, size = "md", showCloseButton = true, panelClassName, contentClassName }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className={cn("gap-0 p-0", sizes[size], panelClassName)} showCloseButton={showCloseButton}>
        {title ? (
          <DialogHeader className="border-b border-[var(--border)] px-6 pt-5 pb-4">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        ) : ariaLabel ? (
          <DialogTitle className="sr-only">{ariaLabel}</DialogTitle>
        ) : null}
        <div className={cn("max-h-[calc(100dvh-7rem)] overflow-y-auto px-6 py-5", contentClassName)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export { Modal };
