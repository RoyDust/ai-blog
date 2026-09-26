"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetcher, handleGlobalSwrError } from "@/lib/client-api";

const REFRESH_INTERVAL_MS = 10000;
type Snapshot = {
  active: boolean;
  counts?: Record<string, number>;
  tasks?: Array<{ id: string; status: string; counts: Record<string, number>; version: string }>;
  posts?: Array<{ id: string; summaryStatus: string; summaryJobId?: string | null; summaryGeneratedAt?: string | null }>;
  missingTaskIds?: string[];
};
type Payload = { success: boolean; data: Snapshot };
const sortedCounts = (counts?: Record<string, number>) => Object.entries(counts ?? {}).sort(([a], [b]) => a.localeCompare(b));
function statusSignature(data: Snapshot) {
  return JSON.stringify({
    active: data.active, counts: sortedCounts(data.counts),
    tasks: data.tasks?.map((task) => ({ id: task.id, status: task.status, counts: sortedCounts(task.counts), version: task.version })).sort((a, b) => a.id.localeCompare(b.id)),
    posts: data.posts?.map((post) => ({ id: post.id, status: post.summaryStatus, jobId: post.summaryJobId, version: post.summaryGeneratedAt })).sort((a, b) => a.id.localeCompare(b.id)),
    missingTaskIds: data.missingTaskIds?.slice().sort(),
  });
}

function useTaskSnapshot(url: string | null, refresh: () => void) {
  const signatures = useRef(new Map<string, string>());
  const { data } = useSWR<Payload>(url, apiFetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: (result) => result?.data.active === false ? 0 : REFRESH_INTERVAL_MS,
    onSuccess: (result, key) => {
      const signature = statusSignature(result.data);
      if (signatures.current.get(key) !== signature) {
        signatures.current.set(key, signature);
        refresh();
      }
    },
    onError: (error, key) => handleGlobalSwrError(error, key),
  });
  return data;
}

/** Independent snapshots retain legacy recovery until the persistent-worker migration. */
export function AiTaskActivitySync({ activeTaskCount, observedTaskIds }: { activeTaskCount: number; observedTaskIds: string[] }) {
  const router = useRouter();
  const ids = [...new Set(observedTaskIds)].sort();
  const query = new URLSearchParams({ resume: "1" });
  ids.forEach((id) => query.append("taskId", id));
  useTaskSnapshot(activeTaskCount > 0 ? "/api/admin/posts/summarize/bulk?resume=1" : null, router.refresh);
  useTaskSnapshot(activeTaskCount > 0 && ids.length > 0 ? "/api/admin/ai/batch?" + query.toString() : null, router.refresh);
  return null;
}
