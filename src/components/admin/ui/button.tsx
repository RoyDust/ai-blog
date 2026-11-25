import * as React from "react";
import {
  Button as CossButton,
  buttonVariants,
} from "@/components/coss/ui/button";

type CossButtonProps = React.ComponentProps<typeof CossButton>;

export type ButtonProps = Omit<CossButtonProps, "variant" | "size"> & {
  variant?: CossButtonProps["variant"] | "primary" | "danger";
  size?: CossButtonProps["size"] | "md";
  asChild?: boolean;
};

function Button({ variant, size, asChild = false, render, children, ...props }: ButtonProps) {
  const mappedVariant =
    variant === "primary" || variant === undefined
      ? "default"
      : variant === "danger"
        ? "destructive"
        : variant;
  const mappedSize = size === "md" || size === undefined ? "default" : size;

  if (asChild && !render && React.isValidElement<{ children?: React.ReactNode }>(children)) {
    const childElement = children;
    const { children: innerChildren, ...childRest } = childElement.props;
    const renderElement = React.createElement(childElement.type, childRest);
    return (
      <CossButton variant={mappedVariant} size={mappedSize} render={renderElement} {...props}>
        {innerChildren}
      </CossButton>
    );
  }

  return (
    <CossButton variant={mappedVariant} size={mappedSize} render={render} {...props}>
      {children}
    </CossButton>
  );
}

export { Button, buttonVariants };
