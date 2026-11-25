"use client";

import type * as React from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent as CossDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
} from "@/components/coss/ui/dialog";
import { cn } from "@/lib/utils";

function DialogContent({
  className,
  ...props
}: React.ComponentProps<typeof CossDialogContent>) {
  return (
    <CossDialogContent
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPanel,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
};
