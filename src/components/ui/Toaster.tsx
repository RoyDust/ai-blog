"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/ThemeProvider";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      closeButton
      position="top-right"
      richColors
      theme={theme}
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
