"use client";

import { Suspense } from "react";

import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalLoginDialog } from "@/components/auth/GlobalLoginDialog";
import { Toaster } from "@/components/ui/Toaster";
import { BlogMotionProvider } from "@/components/motion/BlogMotionProvider";

/**
 * 客户端全局 Provider 装配入口。
 *
 * 这里按“越基础越靠外”的顺序包裹：
 * - AuthProvider：会话与登录态
 * - ThemeProvider：亮暗色与主题状态
 * - Toaster：全局消息提示
 *
 * 任何需要整站共享、且必须运行在客户端的上下文，都优先从这里接入。
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BlogMotionProvider>
          {children}
          <Suspense fallback={null}>
            <GlobalLoginDialog />
          </Suspense>
          <Toaster />
        </BlogMotionProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
