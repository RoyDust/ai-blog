"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  showCloseButton?: boolean;
  panelClassName?: string;
  contentClassName?: string;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

function Modal({ isOpen, onClose, title, children, size = "md", showCloseButton = true, panelClassName, contentClassName }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className={cn(sizes[size], panelClassName)} showCloseButton={showCloseButton}>
        {(title || showCloseButton) ? (
          <DialogHeader className={cn(!title && "sr-only")}>
            {title ? <DialogTitle>{title}</DialogTitle> : <DialogTitle>弹窗</DialogTitle>}
          </DialogHeader>
        ) : null}
        <div className={cn("max-h-[calc(100dvh-7rem)] overflow-y-auto px-6 py-4", contentClassName)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export { Modal };
