"use client";

import type * as React from "react";
import {
  Tooltip,
  TooltipCreateHandle,
  TooltipPopup as CossTooltipPopup,
  TooltipPrimitive,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/coss/ui/tooltip";
import { cn } from "@/lib/utils";

function TooltipPopup({
  className,
  ...props
}: React.ComponentProps<typeof CossTooltipPopup>) {
  return (
    <CossTooltipPopup
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

const TooltipContent = TooltipPopup;

export {
  Tooltip,
  TooltipContent,
  TooltipCreateHandle,
  TooltipPopup,
  TooltipPrimitive,
  TooltipProvider,
  TooltipTrigger,
};
