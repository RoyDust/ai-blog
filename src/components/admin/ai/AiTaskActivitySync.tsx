"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * AI 任务页的后台同步器。
 *
 * 只要还有活跃任务，就定期触发可恢复的任务执行端点并刷新当前路由，
 * 让列表页在无 WebSocket 的情况下也能看到最新进度。
 */
export function AiTaskActivitySync({ activeTaskCount }: { activeTaskCount: number }) {
  const router = useRouter();

  useEffect(() => {
    if (activeTaskCount <= 0) {
      return;
    }

    let cancelled = false;

    /**
     * 尝试推进旧摘要任务和新批量任务。
     *
     * Promise.allSettled 确保单一路径失败不会阻塞另一类任务继续恢复。
     */
    async function sync() {
      await Promise.allSettled([
        fetch("/api/admin/posts/summarize/bulk?resume=1"),
        fetch("/api/admin/ai/batch?resume=1"),
      ]);

      if (!cancelled) {
        router.refresh();
      }
    }

    void sync();
    const timer = window.setInterval(() => {
      void sync();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeTaskCount, router]);

  return null;
}
