"use client";

import type * as React from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent as CossDropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent as CossDropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup as CossMenuPopup,
  MenuPortal,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup as CossMenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/coss/ui/menu";
import { cn } from "@/lib/utils";

function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof CossDropdownMenuContent>) {
  return (
    <CossDropdownMenuContent
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

function MenuPopup({
  className,
  ...props
}: React.ComponentProps<typeof CossMenuPopup>) {
  return (
    <CossMenuPopup
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof CossDropdownMenuSubContent>) {
  return (
    <CossDropdownMenuSubContent
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

function MenuSubPopup({
  className,
  ...props
}: React.ComponentProps<typeof CossMenuSubPopup>) {
  return (
    <CossMenuSubPopup
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuPortal,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
};
