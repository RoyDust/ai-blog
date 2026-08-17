"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { apiMutate } from "@/lib/client-api";

const RESUME_ENDPOINTS = ["/api/admin/posts/summarize/bulk?resume=1", "/api/admin/ai/batch?resume=1"];

const REFRESH_INTERVAL_MS = 10000;

type ResumePayload = { success?: boolean; data?: unknown };

/**
 * 从单个轮询响应中提取"关键状态签名"。
 * 摘要快照会返回活跃标记与各状态计数；批量任务端点不返回状态，
 * 没有状态信息的端点返回固定占位，不参与去抖比较。
 */
function extractStatusSignature(result: PromiseSettledResult<ResumePayload>): string {
  if (result.status === "rejected") {
    return "error";
  }

  const data = result.value?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "no-status";
  }

  const snapshot = data as { active?: boolean; counts?: Record<string, number> };
  return JSON.stringify({ active: snapshot.active ?? null, counts: snapshot.counts ?? null });
}

function buildStatusSignature(results: PromiseSettledResult<ResumePayload>[]): string {
  return results.map(extractStatusSignature).join("|");
}

/**
 * AI 任务页的后台同步器。
 *
 * 只要还有活跃任务，就定期触发可恢复的任务执行端点，让后台在无 WebSocket 的情况下持续推进任务。
 * 轮询交给 SWR 的 refreshInterval（10s）；router.refresh() 去抖——只有当轮询返回的任务状态
 * （活跃标记 + 各状态计数）相对上次发生变化时才刷新整页，避免每次轮询都触发页面刷新与操作日志噪音。
 */
export function AiTaskActivitySync({ activeTaskCount }: { activeTaskCount: number }) {
  const router = useRouter();
  const lastStatusSignatureRef = useRef<string | null>(null);

  useSWR(
    activeTaskCount > 0 ? RESUME_ENDPOINTS : null,
    async (endpoints: string[]) => {
      // Promise.allSettled 确保单一路径失败不会阻塞另一类任务继续恢复
      const results = await Promise.allSettled(endpoints.map((url) => apiMutate<ResumePayload>(url)));
      return buildStatusSignature(results);
    },
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      onSuccess: (signature: string) => {
        if (signature !== lastStatusSignatureRef.current) {
          lastStatusSignatureRef.current = signature;
          router.refresh();
        }
      },
    },
  );

  return null;
}
