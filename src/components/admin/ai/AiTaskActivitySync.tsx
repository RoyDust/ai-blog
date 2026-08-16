"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";

import { apiMutate } from "@/lib/client-api";

const RESUME_ENDPOINTS = ["/api/admin/posts/summarize/bulk?resume=1", "/api/admin/ai/batch?resume=1"];

/**
 * AI 任务页的后台同步器。
 *
 * 只要还有活跃任务，就定期触发可恢复的任务执行端点并刷新当前路由，
 * 让列表页在无 WebSocket 的情况下也能看到最新进度。
 * 轮询交给 SWR 的 refreshInterval（周期与旧实现一致：3s）。
 */
export function AiTaskActivitySync({ activeTaskCount }: { activeTaskCount: number }) {
  const router = useRouter();

  useSWR(
    activeTaskCount > 0 ? RESUME_ENDPOINTS : null,
    async (endpoints: string[]) => {
      // Promise.allSettled 确保单一路径失败不会阻塞另一类任务继续恢复
      await Promise.allSettled(endpoints.map((url) => apiMutate(url)));
      return true;
    },
    {
      refreshInterval: 3000,
      onSuccess: () => {
        router.refresh();
      },
    },
  );

  return null;
}
