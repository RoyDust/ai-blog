"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/ThemeProvider";

/**
 * 方向 A toast（简报第 12 节）：card-bg、1px 描边、4px 圆角、无投影、不放图标，
 * 左侧 2px 竖线区分语气——foreground 是普通，danger 是失败。
 * 位置、时长与关闭按钮沿用原配置，只改样式。
 */
const toasterStyle = {
  "--normal-bg": "var(--card-bg)",
  "--normal-bg-hover": "var(--card-bg)",
  "--normal-border": "var(--reader-border-strong)",
  "--normal-border-hover": "var(--foreground)",
  "--normal-text": "var(--foreground)",
  "--border-radius": "var(--radius-ctl)",
} as CSSProperties;

export const editorialToastClassNames = {
  toast:
    "group/toast !gap-2 !px-4 !py-3 !font-sans !text-[0.875rem] !font-bold !leading-[1.6] !shadow-[inset_2px_0_0_var(--foreground)] data-[type=error]:!text-[var(--danger-foreground)] data-[type=error]:!shadow-[inset_2px_0_0_var(--danger-foreground)]",
  title: "!font-bold",
  description: "!font-medium !text-[var(--text-body)]",
  closeButton:
    "!rounded-[var(--radius-ctl)] !border-[var(--reader-border-strong)] !bg-[var(--card-bg)] !text-[var(--text-muted)] hover:!text-[var(--foreground)]",
  actionButton: "!rounded-[var(--radius-ctl)] !bg-[var(--foreground)] !font-bold !text-[var(--card-bg)]",
  cancelButton: "!rounded-[var(--radius-ctl)] !bg-transparent !font-bold !text-[var(--text-body)]",
};

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      closeButton
      position="top-right"
      theme={theme}
      style={toasterStyle}
      icons={{ success: null, error: null, info: null, warning: null }}
      toastOptions={{
        className: "font-sans",
        classNames: editorialToastClassNames,
      }}
    />
  );
}
