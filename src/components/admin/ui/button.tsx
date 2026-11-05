import type * as React from "react";
import {
  Button as ShadcnButton,
  buttonVariants,
} from "@/components/shadcn/ui/button";

type ShadcnButtonProps = React.ComponentProps<typeof ShadcnButton>;

/**
 * 后台按钮（方向 A 三级）：
 * - `primary`（默认）：foreground 实底主按钮，每页最多一个；
 * - `outline`：描边按钮，次要提交与批量操作；`outline-danger` 破坏性的描边版；
 * - `danger`：danger 实底，只用于危险确认弹窗里的最终确认；
 * - `ghost`：透明图标 / 工具按钮；
 * - `text` / `text-danger`：行内下划线文字按钮（批准、编辑、删除），不带箭头。
 * 尺寸：默认 36px，`sm` 32px，`icon-sm` 32px 方形。
 */
export type ButtonProps = Omit<ShadcnButtonProps, "variant" | "size"> & {
  variant?: ShadcnButtonProps["variant"] | "primary" | "danger" | "text" | "text-danger";
  size?: ShadcnButtonProps["size"] | "md";
};

function mapVariant(variant: ButtonProps["variant"]): ShadcnButtonProps["variant"] {
  switch (variant) {
    case undefined:
    case "primary":
      return "default";
    case "danger":
      return "destructive";
    case "text":
      return "link";
    case "text-danger":
      return "link-danger";
    default:
      return variant;
  }
}

function Button({ variant, size, ...props }: ButtonProps) {
  const mappedSize = size === "md" || size === undefined ? "default" : size;

  return <ShadcnButton variant={mapVariant(variant)} size={mappedSize} {...props} />;
}

export { Button, buttonVariants };
