"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AiTaskActivitySync({ activeTaskCount }: { activeTaskCount: number }) {
  const router = useRouter();

  useEffect(() => {
    if (activeTaskCount <= 0) {
      return;
    }

    let cancelled = false;

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
