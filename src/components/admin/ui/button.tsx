import type * as React from "react";
import {
  Button as ShadcnButton,
  buttonVariants,
} from "@/components/shadcn/ui/button";

type ShadcnButtonProps = React.ComponentProps<typeof ShadcnButton>;

export type ButtonProps = Omit<ShadcnButtonProps, "variant" | "size"> & {
  variant?: ShadcnButtonProps["variant"] | "primary" | "danger";
  size?: ShadcnButtonProps["size"] | "md";
};

function Button({ variant, size, ...props }: ButtonProps) {
  const mappedVariant =
    variant === "primary" || variant === undefined
      ? "default"
      : variant === "danger"
        ? "destructive"
        : variant;
  const mappedSize = size === "md" || size === undefined ? "default" : size;

  return <ShadcnButton variant={mappedVariant} size={mappedSize} {...props} />;
}

export { Button, buttonVariants };
