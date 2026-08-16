"use client";

import { Suspense } from "react";
import { SWRConfig } from "swr";

import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GlobalLoginDialog } from "@/components/auth/GlobalLoginDialog";
import { Toaster } from "@/components/ui/Toaster";
import { BlogMotionProvider } from "@/components/motion/BlogMotionProvider";
import { apiFetcher, handleGlobalSwrError } from "@/lib/client-api";

export { handleGlobalSwrError, shouldRedirectAdminUnauthorized } from "@/lib/client-api";

/**
 * 全局 SWR 配置。
 * - fetcher：统一走 client-api 的 apiFetcher（错误契约与后台 readApiJson 一致）
 * - revalidateOnFocus：前台阅读场景关闭焦点重验证，避免页面回切时整页重取；
 *   需要实时性的后台页面（通知、日志等）在局部用 mutate / refreshInterval 控制
 * - 错误重试：最多 2 次、间隔 5s，避免瞬时抖动刷屏
 * - onError：后台接口 401 跳登录弹层，避免列表停留在错误态
 */
const swrConfig = {
  fetcher: apiFetcher,
  dedupingInterval: 2000,
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 5000,
  onError: handleGlobalSwrError,
};

/**
 * 客户端全局 Provider 装配入口。
 *
 * 这里按“越基础越靠外”的顺序包裹：
 * - SWRConfig：全局数据请求配置（key 缓存 / 去重 / 错误重试）
 * - AuthProvider：会话与登录态
 * - ThemeProvider：亮暗色与主题状态
 * - Toaster：全局消息提示
 *
 * 任何需要整站共享、且必须运行在客户端的上下文，都优先从这里接入。
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
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
    </SWRConfig>
  );
}
