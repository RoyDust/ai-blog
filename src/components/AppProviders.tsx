"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MotionProvider } from "@/components/motion";
import { Toaster } from "@/components/ui/Toaster";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MotionProvider>
          {children}
          <Toaster />
        </MotionProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
