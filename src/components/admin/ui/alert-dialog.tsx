"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent as CossAlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPopup,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogViewport,
} from "@/components/coss/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof CossAlertDialogContent>) {
  return (
    <CossAlertDialogContent
      className={cn("admin-theme", className)}
      {...props}
    />
  );
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted *:[svg:not([class*='size-'])]:size-8",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  if (
    asChild &&
    !props.render &&
    React.isValidElement<{
      children?: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLElement>;
    }>(children)
  ) {
    const {
      children: innerChildren,
      onClick: childOnClick,
      ...childRest
    } = children.props;
    const parentOnClick = props.onClick;
    const renderElement = React.createElement(children.type, {
      ...childRest,
      onClick: undefined,
    });

    return (
      <Button
        data-slot="alert-dialog-action"
        variant={variant}
        size={size}
        className={className}
        {...props}
        onClick={
          parentOnClick || childOnClick
            ? (event) => {
                parentOnClick?.(event);
                if (!event.defaultPrevented) {
                  childOnClick?.(event);
                }
              }
            : undefined
        }
        render={renderElement}
      >
        {innerChildren}
      </Button>
    );
  }

  return (
    <Button
      data-slot="alert-dialog-action"
      variant={variant}
      size={size}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  asChild = false,
  children,
  render,
  ...props
}: React.ComponentProps<typeof AlertDialogClose> &
  Pick<ButtonProps, "variant" | "size"> & {
    asChild?: boolean;
  }) {
  if (asChild && !render && React.isValidElement<{ children?: React.ReactNode }>(children)) {
    const { children: innerChildren, ...childRest } = children.props;
    const renderElement = React.createElement(children.type, childRest);
    return (
      <AlertDialogClose
        data-slot="alert-dialog-cancel"
        className={className}
        render={renderElement}
        {...props}
      >
        {innerChildren}
      </AlertDialogClose>
    );
  }

  return (
    <AlertDialogClose
      data-slot="alert-dialog-cancel"
      className={className}
      render={render ?? <Button type="button" variant={variant} size={size} />}
      {...props}
    >
      {children}
    </AlertDialogClose>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBackdrop,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPopup,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogViewport,
};
